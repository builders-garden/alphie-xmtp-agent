import type { Job } from "bullmq";
import { resolveGroupId } from "../../../lib/db/queries/group.query.js";
import {
	addUsersToGroupTrackings,
	removeUsersFromGroupTrackings,
} from "../../../lib/db/queries/index.js";
import {
	getLatestNeynarWebhookFromDb,
	updateNeynarWebhookInDb,
} from "../../../lib/db/queries/webhook.query.js";
import {
	getNeynarWebhookById,
	updateNeynarWebhookTradeCreated,
} from "../../../lib/neynar.js";
import type { JobResult, UpdateUsersJobData } from "../../../types/index.js";

const areSetsEqual = <T>(a: Set<T>, b: Set<T>): boolean => {
	if (a.size !== b.size) return false;
	for (const value of a) {
		if (!b.has(value)) return false;
	}
	return true;
};

/**
 * Process update users job - add/remove users to/from neynar webhook
 * @param job - The BullMQ job containing the processing request
 */
export const processUpdateUsersJob = async (
	job: Job<UpdateUsersJobData>,
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
		const webhook = await getLatestNeynarWebhookFromDb();

		// if no webhook saved in db, create a new webhook in neynar and save it to db
		if (!webhook) {
			throw new Error("Neynar webhook not found in db");
		}
		const neynarWebhook = await getNeynarWebhookById(webhook.neynarWebhookId);
		if (!neynarWebhook) {
			throw new Error("Neynar webhook not found in neynar");
		}
		console.log("neynarWebhook", neynarWebhook);

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
				}),
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

		// Calculate merged FIDs to apply to the webhook directly from inputs
		const currentFids = Array.isArray(
			neynarWebhook.subscription.filters["trade.created"].fids,
		)
			? neynarWebhook.subscription.filters["trade.created"].fids
			: [];
		const newFidsSet = new Set<number>(currentFids);
		for (const { fid } of addUsersInput) newFidsSet.add(fid);
		for (const fid of removeFidsSet) newFidsSet.delete(fid);
		const mergedFids = Array.from(newFidsSet);

		// Check if webhook actually changes
		const currentFidsSet = new Set<number>(currentFids);
		const setsEqual = areSetsEqual(currentFidsSet, newFidsSet);

		if (setsEqual) {
			// Webhook subscriptions unchanged; still ensure DB tracking updates
			if (trackingAddsResolved.length > 0) {
				await addUsersToGroupTrackings(trackingAddsResolved);
				console.log(
					`[update-users-job] Ensured group trackings for users ${trackingAddsResolved.map((u) => u.userId)}`,
				);
			}
			if (hasRemovals) {
				for (const [groupId, userIds] of removalsByResolvedGroup.entries()) {
					await removeUsersFromGroupTrackings(groupId, userIds);
				}
				console.log(
					`[update-users-job] Removed users from group trackings ${Array.from(removalsByResolvedGroup.values()).flat()}`,
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
				`[update-users-job] Webhook updated successfully in db ${updatedWebhook.webhook.webhook_id}`,
			);
			await job.updateProgress(80);
			// add users to group trackings (for all addUsers requested)
			if (trackingAddsResolved.length > 0) {
				await addUsersToGroupTrackings(trackingAddsResolved);
				console.log(
					`[update-users-job] Added users to group trackings ${trackingAddsResolved.map((u) => u.userId)}`,
				);
			}

			// remove users from group trackings (if any)
			if (hasRemovals) {
				for (const [groupId, userIds] of removalsByResolvedGroup.entries()) {
					await removeUsersFromGroupTrackings(groupId, userIds);
				}
				console.log(
					`[update-users-job] Removed users from group trackings ${Array.from(removalsByResolvedGroup.values()).flat()}`,
				);
			}
			await job.updateProgress(100);
			return {
				status: "success",
				message: `Updated webhook ${webhook.neynarWebhookId}: now tracking ${mergedFids.length} fids`,
			};
		}

		return {
			status: "failed",
			error: "Error creating new webhook",
		};
	} catch (error) {
		console.error(`[update-users-job] Job ${job.id} failed:`, error);
		return {
			status: "failed",
			error: `Error creating new webhook ${error}`,
		};
	}
};
