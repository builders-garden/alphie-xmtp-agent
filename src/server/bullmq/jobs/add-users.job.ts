import type { Job } from "bullmq";
import {
	addUsersToGroupTrackings,
	getDistinctTrackedUsers,
} from "../../../lib/db/queries/index.js";
import {
	getLatestNeynarWebhookFromDb,
	saveNeynarWebhookInDb,
	updateNeynarWebhookInDb,
} from "../../../lib/db/queries/webhook.query.js";
import { env } from "../../../lib/env.js";
import {
	createNeynarWebhookTradeCreated,
	updateNeynarWebhookTradeCreated,
} from "../../../lib/neynar.js";
import type { AddUsersJobData, JobResult } from "../../../types/index.js";

/**
 * Process add users job - add users to neynar webhook
 * @param job - The BullMQ job containing the processing request
 */
export const processAddUsersJob = async (
	job: Job<AddUsersJobData>,
): Promise<JobResult> => {
	const { users: jobUsers } = job.data;

	try {
		console.log(`[add-users-job] Starting job ${job.id}`);

		// Validate input
		if (!jobUsers || jobUsers.length === 0) {
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

		// Determine which fids are already tracked
		const jobUsersFids = jobUsers.map((u) => u.fid);
		const inputFidsSet = new Set(jobUsersFids);

		// Determine which fids are already tracked
		const alreadyTrackedFids = users
			.filter((u) => typeof u.fid === "number" && inputFidsSet.has(u.fid))
			.map((u) => u.fid as number);
		const alreadyTrackedFidsSet = new Set<number>(alreadyTrackedFids);

		// Determine which fids are not already tracked
		const fidsToAdd =
			alreadyTrackedFidsSet.size === 0
				? Array.from(inputFidsSet)
				: Array.from(inputFidsSet).filter((f) => !alreadyTrackedFidsSet.has(f));
		// create mapping of fids to users
		const fidsToUsers = jobUsers.filter((u) => fidsToAdd.includes(u.fid));

		if (fidsToAdd.length === 0) {
			await job.updateProgress(100);
			console.log("[add-users-job] All provided users are already tracked", {
				userFids: jobUsersFids,
				alreadyTrackedFids,
			});
			return {
				status: "success",
				message: "All provided users already tracked in webhook",
			};
		}

		// if no webhook saved in db, create a new webhook in neynar and save it to db
		if (!webhook) {
			await job.updateProgress(40);
			console.log(
				"[add-users-job] No existing webhook found, creating a new webhook in neynar",
			);
			const newWebhook = await createNeynarWebhookTradeCreated({
				webhookNumber: 1,
				webhookUrl: `${env.BACKEND_URL}/api/v1/copy-trade`,
				fids: fidsToAdd,
			});
			console.log(
				`[add-users-job] New webhook created in neynar ${newWebhook}`,
			);
			if ("success" in newWebhook) {
				console.log(
					`[add-users-job] Neynar webhook created successfully ${newWebhook.webhook.webhook_id}`,
				);
				await job.updateProgress(80);
				try {
					const savedWebhook = await saveNeynarWebhookInDb(newWebhook);
					if (savedWebhook) {
						console.log(
							`[add-users-job] New webhook saved successfully in db ${savedWebhook.neynarWebhookId}`,
						);
						await job.updateProgress(80);

						// add users to group trackings
						await addUsersToGroupTrackings(
							fidsToUsers.map((u) => ({
								groupId: u.groupId ?? "",
								userId: u.userId,
							})),
						);
						console.log(
							`[add-users-job] Added users to group trackings ${fidsToUsers.map((u) => u.userId)}`,
						);
						await job.updateProgress(100);
						return {
							status: "success",
							message: "New webhook created successfully",
						};
					}
				} catch (error) {
					console.error(
						`[add-users-job] Error saving new webhook in db ${error}`,
					);
					return {
						status: "failed",
						error: `Error saving new webhook in db ${error}`,
					};
				}
			}
			console.error(
				`[add-users-job] Error creating new webhook ${newWebhook.message}`,
			);
			return {
				status: "failed",
				error: `Error creating new webhook ${newWebhook.message}`,
			};
		}

		// update the webhook with the new user fids
		const mergedFids = Array.from(
			new Set([...(webhook.fids || []), ...fidsToAdd]),
		);
		const updatedWebhook = await updateNeynarWebhookTradeCreated({
			webhookId: webhook.neynarWebhookId,
			fids: mergedFids,
		});
		if ("success" in updatedWebhook) {
			await updateNeynarWebhookInDb(updatedWebhook);
			console.log(
				`[add-users-job] Webhook updated successfully in db ${updatedWebhook.webhook.webhook_id}`,
			);
			await job.updateProgress(80);
			// add users to group trackings
			await addUsersToGroupTrackings(
				fidsToUsers.map((u) => ({
					groupId: u.groupId ?? "",
					userId: u.userId,
				})),
			);
			console.log(
				`[add-users-job] Added users to group trackings ${fidsToUsers.map((u) => u.userId)}`,
			);
			await job.updateProgress(100);
			return {
				status: "success",
				message: `Added ${fidsToAdd.length} user(s) to webhook ${webhook.neynarWebhookId}`,
			};
		}

		return {
			status: "failed",
			error: "Error creating new webhook",
		};
	} catch (error) {
		console.error(`[add-users-job] Job ${job.id} failed:`, error);
		return {
			status: "failed",
			error: `Error creating new webhook ${error}`,
		};
	}
};
