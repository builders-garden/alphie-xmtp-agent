import type { Job } from "bullmq";
import { resolveGroupId } from "../../../lib/db/queries/group.query.js";
import {
	addUsersToGroupTrackings,
	countGroupsTrackingUserByFarcasterFid,
	removeUsersFromGroupTrackings,
} from "../../../lib/db/queries/index.js";
import {
	getNeynarWebhookByIdFromDb,
	updateNeynarWebhookInDb,
} from "../../../lib/db/queries/webhook.query.js";
import { env } from "../../../lib/env.js";
import {
	getNeynarWebhookById,
	updateNeynarWebhookTradeCreated,
} from "../../../lib/neynar.js";
import type { JobResult, UpdateUsersJobData } from "../../../types/index.js";

/**
 * Process update users job - add/remove users to/from neynar webhook
 * @param job - The BullMQ job containing the processing request
 */
export const processUpdateUsersJob = async (
	job: Job<UpdateUsersJobData>
): Promise<JobResult> => {
	const { addUsers: jobAddUsers, removeUsers: jobRemoveUsers } = job.data;

	try {
		console.log(`[update-users-job] Starting job ${job.id}`);

		// Validate input
		if (
			(!jobAddUsers || jobAddUsers.length === 0) &&
			(!jobRemoveUsers || jobRemoveUsers.length === 0)
		) {
			await job.updateProgress(100);
			return {
				status: "failed",
				error: "No users provided",
			};
		}
		await job.updateProgress(5);

		// get latest webhook from DB
		const webhook = await getNeynarWebhookByIdFromDb(env.NEYNAR_WEBHOOK_ID);

		// if no webhook saved in db, create a new webhook in neynar and save it to db
		if (!webhook) {
			console.error("[update-users-job] Neynar webhook not found in db");
			throw new Error("Neynar webhook not found in db");
		}
		const neynarWebhook = await getNeynarWebhookById(webhook.neynarWebhookId);
		if (!neynarWebhook) {
			throw new Error("Neynar webhook not found in neynar");
		}
		console.log(
			"neynarWebhook",
			neynarWebhook.subscription.filters["trade.created"]
		);

		// Normalize inputs
		const addUsersInput = jobAddUsers ?? [];
		const removeUsersInput = jobRemoveUsers ?? [];

		// Prepare tracking adds for all requested addUsers (independent of webhook state)
		const trackingAddsRaw = addUsersInput.map((u) => ({
			groupId: u.groupId ?? "",
			userId: u.userId,
		}));

		// Resolve group ids: input may be a DB group.id (ULID) or a conversationId
		const trackingAddsResolved = (
			await Promise.all(
				trackingAddsRaw.map(async (row) => {
					const resolved = await resolveGroupId(row.groupId);
					return resolved ? { groupId: resolved, userId: row.userId } : null;
				})
			)
		).filter((r): r is { groupId: string; userId: string } => r !== null);

		// Prepare removal data
		const removeFidsSet = new Set<number>(removeUsersInput.map((u) => u.fid));
		const hasRemovals = removeFidsSet.size > 0;
		const removalsByGroup = new Map<string, string[]>();
		for (const r of removeUsersInput) {
			if (!r.groupId) continue;
			const current = removalsByGroup.get(r.groupId) ?? [];
			current.push(r.userId);
			removalsByGroup.set(r.groupId, current);
		}

		// Resolve removal group ids as well
		const removalsByResolvedGroup = new Map<string, string[]>();
		for (const [maybeGroupId, userIds] of removalsByGroup.entries()) {
			const resolved = await resolveGroupId(maybeGroupId);
			if (!resolved) continue;
			const list = removalsByResolvedGroup.get(resolved) ?? [];
			removalsByResolvedGroup.set(resolved, list.concat(userIds));
		}

		// Calculate merged FIDs with reference counting so a fid stays on the webhook
		// as long as at least one group is still tracking it after this job.
		const currentWebhookFids = Array.isArray(
			neynarWebhook.subscription.filters["trade.created"].fids
		)
			? neynarWebhook.subscription.filters["trade.created"].fids
			: [];
		const targetFids = new Set<number>(currentWebhookFids);

		// Maps from userId -> fid
		const addUserIdToFid = getUserIdToFidMap(addUsersInput);
		const removeUserIdToFid = getUserIdToFidMap(removeUsersInput);

		// Unique pair counts by fid
		const addCountsByFid = computeAddCountsByFid(
			trackingAddsResolved,
			addUserIdToFid
		);
		const removeCountsByFid = computeRemoveCountsByFid(
			removalsByResolvedGroup,
			removeUserIdToFid
		);

		// Only recompute for fids actually affected in this job
		const fidsToCheck = setsFromKeys(addCountsByFid, removeCountsByFid);
		const baseCounts = await Promise.all(
			Array.from(fidsToCheck).map(
				async (fid) =>
					[fid, await countGroupsTrackingUserByFarcasterFid(fid)] as const
			)
		);
		const baseCountByFid = new Map<number, number>(baseCounts);

		for (const fid of fidsToCheck) {
			const base = baseCountByFid.get(fid) ?? 0;
			const addDelta = addCountsByFid.get(fid) ?? 0;
			const removeDelta = removeCountsByFid.get(fid) ?? 0;
			const resulting = base + addDelta - removeDelta;
			if (resulting > 0) {
				targetFids.add(fid);
			} else {
				targetFids.delete(fid);
			}
		}

		const mergedFids = Array.from(targetFids);

		// Check if webhook actually changes
		const currentFidsSet = new Set<number>(currentWebhookFids);
		const setsEqual = areSetsEqual(currentFidsSet, targetFids);

		if (setsEqual) {
			// Webhook subscriptions unchanged; still ensure DB tracking updates
			if (trackingAddsResolved.length > 0) {
				await addUsersToGroupTrackings(trackingAddsResolved);
				console.log(
					`[update-users-job] Ensured group trackings for users ${trackingAddsResolved.map((u) => u.userId)}`
				);
			}
			if (hasRemovals) {
				for (const [groupId, userIds] of removalsByResolvedGroup.entries()) {
					await removeUsersFromGroupTrackings(groupId, userIds);
				}
				console.log(
					`[update-users-job] Removed users from group trackings ${Array.from(removalsByResolvedGroup.values()).flat()}`
				);
			}
			await job.updateProgress(100);
			return {
				status: "success",
				message: "No webhook changes; group trackings updated",
			};
		}

		console.log("mergedFids", mergedFids);

		// update the webhook in neynar
		const updatedWebhook = await updateNeynarWebhookTradeCreated({
			webhookId: webhook.neynarWebhookId,
			webhookUrl: webhook.webhookUrl,
			webhookName: webhook.webhookName,
			fids: mergedFids,
		});
		if ("webhook" in updatedWebhook) {
			await updateNeynarWebhookInDb(updatedWebhook);
			console.log(
				`[update-users-job] Webhook updated successfully in db ${updatedWebhook.webhook.webhook_id}`
			);
			await job.updateProgress(80);
			// add users to group trackings (for all addUsers requested)
			if (trackingAddsResolved.length > 0) {
				await addUsersToGroupTrackings(trackingAddsResolved);
				console.log(
					`[update-users-job] Added users to group trackings ${trackingAddsResolved.map((u) => u.userId)}`
				);
			}

			// remove users from group trackings (if any)
			if (hasRemovals) {
				for (const [groupId, userIds] of removalsByResolvedGroup.entries()) {
					await removeUsersFromGroupTrackings(groupId, userIds);
				}
				console.log(
					`[update-users-job] Removed users from group trackings ${Array.from(removalsByResolvedGroup.values()).flat()}`
				);
			}
			await job.updateProgress(100);
			return {
				status: "success",
				message: `Updated webhook ${webhook.neynarWebhookId}: now tracking ${mergedFids.length} fids`,
			};
		}

		console.error(
			"[update-users-job] error in updating neynar webhook",
			updatedWebhook
		);
		throw new Error("Error updating the webhook");
	} catch (error) {
		console.error(`[update-users-job] Job ${job.id} failed:`, error);
		throw error;
	}
};

/**
 *
 * @param a - The first set
 * @param b - The second set
 * @returns True if the sets are equal, false otherwise
 * @returns
 */
const areSetsEqual = <T>(a: Set<T>, b: Set<T>) => {
	if (a.size !== b.size) return false;
	return Array.from(a).every((value) => b.has(value));
};

/**
 * Get a map from userId to fid
 * @param users - The users to get the map from
 * @returns A map from userId to fid
 */
const getUserIdToFidMap = (
	users: Array<{ userId: string; fid: number | undefined }>
) => {
	const map = new Map<string, number>();
	for (const u of users) {
		if (typeof u.fid === "number") {
			map.set(u.userId, u.fid);
		}
	}
	return map;
};

/**
 * Compute the counts of fids by add users
 * @param trackingAddsResolved - The tracking adds resolved
 * @param addUserIdToFid - The map from userId to fid
 * @returns The counts of fids by add users
 */
const computeAddCountsByFid = (
	trackingAddsResolved: Array<{ groupId: string; userId: string }>,
	addUserIdToFid: Map<string, number>
) => {
	const seen = new Set<string>();
	const counts = new Map<number, number>();
	for (const row of trackingAddsResolved) {
		const fid = addUserIdToFid.get(row.userId);
		if (fid == null) {
			continue;
		}
		const key = `${fid}:${row.groupId}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		counts.set(fid, (counts.get(fid) ?? 0) + 1);
	}
	return counts;
};

/**
 * Compute the counts of fids by remove users
 * @param removalsByResolvedGroup - The removals by resolved group
 * @param removeUserIdToFid - The map from userId to fid
 * @returns The counts of fids by remove users
 */
const computeRemoveCountsByFid = (
	removalsByResolvedGroup: Map<string, string[]>,
	removeUserIdToFid: Map<string, number>
) => {
	const seen = new Set<string>();
	const counts = new Map<number, number>();
	for (const [groupId, userIds] of removalsByResolvedGroup.entries()) {
		for (const userId of userIds) {
			const fid = removeUserIdToFid.get(userId);
			if (fid == null) {
				continue;
			}
			const key = `${fid}:${groupId}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			counts.set(fid, (counts.get(fid) ?? 0) + 1);
		}
	}
	return counts;
};

/**
 * Get a set of keys from two maps
 * @param mapA - The first map
 * @param mapB - The second map
 * @returns A set of keys
 */
const setsFromKeys = <K>(mapA: Map<K, unknown>, mapB: Map<K, unknown>) => {
	return new Set<K>([...Array.from(mapA.keys()), ...Array.from(mapB.keys())]);
};
