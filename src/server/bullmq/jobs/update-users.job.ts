import type { Job } from "bullmq";
import {
	addUsersToGroupTrackings,
	getDistinctTrackedUsers,
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

/**
 * Process add users job - add users to neynar webhook
 * @param job - The BullMQ job containing the processing request
 */
export const processAddUsersJob = async (
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

		// get all the distinct users that we are already tracking
		const [users, webhook] = await Promise.all([
			getDistinctTrackedUsers(),
			getLatestNeynarWebhookFromDb(),
		]);

		// if no webhook saved in db, create a new webhook in neynar and save it to db
		if (!webhook) {
			throw new Error("Neynar webhook not found in db");
		}
		const neynarWebhook = await getNeynarWebhookById(webhook.neynarWebhookId);
		if (!neynarWebhook) {
			throw new Error("Neynar webhook not found in neynar");
		}
		console.log("neynarWebhook", neynarWebhook);

		// Determine which fids are already tracked (for add path)
		const addUsersInput = jobAddUsers ?? [];
		const removeUsersInput = jobRemoveUsers ?? [];

		const jobUsersFids = addUsersInput.map((u) => u.fid);
		const inputFidsSet = new Set(jobUsersFids);

		const alreadyTrackedFids = users
			.filter((u) => typeof u.fid === "number" && inputFidsSet.has(u.fid))
			.map((u) => u.fid as number);
		const alreadyTrackedFidsSet = new Set<number>(alreadyTrackedFids);

		// Determine which fids are not already tracked
		const fidsToAdd =
			alreadyTrackedFidsSet.size === 0
				? Array.from(inputFidsSet)
				: Array.from(inputFidsSet).filter((f) => !alreadyTrackedFidsSet.has(f));
		// Prepare tracking adds for all requested addUsers (independent of webhook state)
		const trackingAdds = addUsersInput.map((u) => ({
			groupId: u.groupId ?? "",
			userId: u.userId,
		}));

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

		if (fidsToAdd.length === 0 && !hasRemovals) {
			// Ensure group trackings are added even if webhook does not change
			if (trackingAdds.length > 0) {
				await addUsersToGroupTrackings(trackingAdds);
				console.log(
					`[update-users-job] Ensured group trackings for users ${trackingAdds.map((u) => u.userId)}`,
				);
			}
			await job.updateProgress(100);
			console.log(
				"[update-users-job] No changes to process (no adds or removals)",
			);
			return {
				status: "success",
				message: "No changes to process",
			};
		}

		// update the webhook with the new user fids (apply adds and removals)
		const currentFids = Array.isArray(
			neynarWebhook.subscription.filters["trade.created"].fids,
		)
			? neynarWebhook.subscription.filters["trade.created"].fids
			: [];
		const newFidsSet = new Set<number>(currentFids);
		for (const fid of fidsToAdd) newFidsSet.add(fid);
		for (const fid of removeFidsSet) newFidsSet.delete(fid);
		const mergedFids = Array.from(newFidsSet);

		// update the webhook in neynar
		const updatedWebhook = await updateNeynarWebhookTradeCreated({
			webhookId: webhook.neynarWebhookId,
			webhookUrl: webhook.webhookUrl,
			webhookName: webhook.webhookName,
			fids: mergedFids,
		});
		if ("success" in updatedWebhook) {
			await updateNeynarWebhookInDb(updatedWebhook);
			console.log(
				`[update-users-job] Webhook updated successfully in db ${updatedWebhook.webhook.webhook_id}`,
			);
			await job.updateProgress(80);
			// add users to group trackings (for all addUsers requested)
			if (trackingAdds.length > 0) {
				await addUsersToGroupTrackings(trackingAdds);
				console.log(
					`[update-users-job] Added users to group trackings ${trackingAdds.map((u) => u.userId)}`,
				);
			}

			// remove users from group trackings (if any)
			if (hasRemovals) {
				for (const [groupId, userIds] of removalsByGroup.entries()) {
					await removeUsersFromGroupTrackings(groupId, userIds);
				}
				console.log(
					`[update-users-job] Removed users from group trackings ${Array.from(removalsByGroup.values()).flat()}`,
				);
			}
			await job.updateProgress(100);
			return {
				status: "success",
				message: `Updated webhook ${webhook.neynarWebhookId}: added ${fidsToAdd.length}, removed ${removeFidsSet.size}`,
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
