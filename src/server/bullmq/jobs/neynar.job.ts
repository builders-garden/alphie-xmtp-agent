import type { Job } from "bullmq";
import type { Address } from "viem";
import { getGroupsTrackingUserByFarcasterFid } from "../../../lib/db/queries/index.js";
import { env } from "../../../lib/env.js";
import { fetchUserFromNeynarByFid } from "../../../lib/neynar.js";
import { createXmtpAgent } from "../../../lib/xmtp/agent.js";
import {
	ContentTypeActions,
	type JobResult,
	type NeynarWebhookJobData,
} from "../../../types/index.js";
import { getTokenInfo, getXmtpCopyTradeAction } from "../../../utils/index.js";

/**
 * Process neynar webhook - handle copy trade for any farcaster user
 * @param job - The BullMQ job containing the processing request
 */
export const processNeynarWebhookJob = async (
	job: Job<NeynarWebhookJobData>,
): Promise<JobResult> => {
	const { user, transaction } = job.data;
	let progress = 5;

	console.log(
		`[neynar-webhook-job] Starting job ${job.id} for user ${user.fid}`,
	);
	await job.updateProgress(progress);

	try {
		const neynarUser = await fetchUserFromNeynarByFid(user.fid);
		if (!neynarUser) {
			console.error("❌ Unable to get neynar user");
			return {
				status: "failed",
				error: "Unable to get neynar user",
			};
		}

		// get groups that are tracking the user
		const groups = await getGroupsTrackingUserByFarcasterFid(user.fid);
		if (groups.length === 0) {
			await job.updateProgress(100);
			console.log("[neynar-webhook-job] No groups found");
			return {
				status: "success",
				message: "No groups are tracking the given user",
			};
		}

		// instantiate xmtp agent
		const xmtpAgent = await createXmtpAgent();
		await xmtpAgent.client.conversations.sync();

		const agentAddress = xmtpAgent.address;
		if (!agentAddress) {
			console.error("❌ Unable to get xmtp agent address");
			return {
				status: "failed",
				error: "Unable to get xmtp agent address",
			};
		}
		progress = 10;
		await job.updateProgress(progress);

		// build copy trade action
		const token = await getTokenInfo({
			sellTokenAddress: transaction.sellToken,
			buyTokenAddress: transaction.buyToken,
			chainId: transaction.chainId,
		});
		const sellAmount = Number.parseFloat(transaction.sellAmount).toFixed(2);

		const actionMessage = `Copy trade @${neynarUser.username}: Swap ${sellAmount} ${token.sellSymbol} for ${token.buySymbol}`;
		const action = getXmtpCopyTradeAction({
			actionMessage,
			transaction,
			agentAddress: agentAddress as Address,
		});
		progress = 15;
		await job.updateProgress(progress);
		console.log("[neynar-webhook-job] Building copy trade action");

		const totalGroups = groups.length;
		let completedGroups = 0;
		const incrementProgress = (100 - progress) / totalGroups;

		// iterate over groups and send copy trade message
		for (const group of groups) {
			const conversation =
				await xmtpAgent.client.conversations.getConversationById(
					group.group.conversationId,
				);
			if (!conversation) {
				console.error("❌ Unable to get conversation");
				return {
					status: "failed",
					error: "Unable to get conversation",
				};
			}

			// send copy trade action to the group chat
			await conversation.send(action, ContentTypeActions);
			await conversation.send(
				`See more details here ${env.APP_URL}/g/${group.groupId}/tx/${transaction.transactionHash}`,
			);
			console.log(
				`Copy trade action sent to the group chat ${conversation.id}`,
			);

			completedGroups += 1;
			progress += incrementProgress;
			await job.updateProgress(progress);
			console.log(
				`[neynar-webhook-job] Progress: ${progress}% (${completedGroups}/${totalGroups})`,
			);
		}

		await job.updateProgress(100);
		return {
			status: "success",
			message: "Copy trade handled successfully",
		};
	} catch (error) {
		console.error(`[neynar-webhook-job] Job ${job.id} failed:`, error);
		throw error;
	}
};
