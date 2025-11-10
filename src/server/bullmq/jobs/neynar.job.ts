import type { Job } from "bullmq";
import { ulid } from "ulid";
import type { Address } from "viem";
import { getTokenInfoFromCodex } from "../../../lib/codex.js";
import { saveActivityForMultipleGroups } from "../../../lib/db/queries/group-activity.query.js";
import {
	getGroupsTrackingUserByFarcasterFid,
	getUserByFarcasterFid,
} from "../../../lib/db/queries/index.js";
import {
	getTokenInfoFromDb,
	saveTokenInDb,
} from "../../../lib/db/queries/tokens.query.js";
import {
	getUserActivityByTxHashAndChainId,
	saveUserActivityInDb,
} from "../../../lib/db/queries/user-activity.query.js";
import { env } from "../../../lib/env.js";
import { createXmtpAgent } from "../../../lib/xmtp/agent.js";
import {
	ContentTypeActions,
	type JobResult,
	type NeynarWebhookJobData,
} from "../../../types/index.js";
import { getTokenInfo, getXmtpCopyTradeAction } from "../../../utils/index.js";
import { getTokenPriceAndFdv } from "../../../utils/token.util.js";

/**
 * Process neynar webhook - handle copy trade for any farcaster user
 * @param job - The BullMQ job containing the processing request
 */
export const processNeynarWebhookJob = async (
	job: Job<NeynarWebhookJobData>,
): Promise<JobResult> => {
	const { user, transaction, rawTransaction, groupId } = job.data;
	let progress = 5;

	console.log(
		`[neynar-webhook-job] Starting job ${job.id} for user ${user.fid}`,
		job.data,
	);
	await job.updateProgress(progress);

	try {
		// check if activity already exists in db
		const activity = await getUserActivityByTxHashAndChainId({
			txHash: transaction.transactionHash,
			chainId: transaction.chainId,
		});
		if (activity && env.NODE_ENV === "production") {
			await job.updateProgress(100);
			console.log(
				`[neynar-webhook-job] job ${job.id} Activity already exists in db for tx hash ${transaction.transactionHash} on chain ${transaction.chainId}`,
			);
			return {
				status: "success",
				message: `Activity already exists in db for tx hash ${transaction.transactionHash} on chain ${transaction.chainId}`,
			};
		}

		// get user in db
		const userInDb = await getUserByFarcasterFid(user.fid);
		if (!userInDb) {
			console.error(
				`[neynar-webhook-job] job ${job.id} ❌ Unable to get user in db`,
			);
			return {
				status: "failed",
				error: "Unable to get user in db",
			};
		}

		// get groups that are tracking the user
		const groups = await getGroupsTrackingUserByFarcasterFid(user.fid, groupId);
		if (groups.length === 0) {
			await job.updateProgress(100);
			console.log(
				`[neynar-webhook-job] job ${job.id} No groups found for user ${user.fid}`,
			);
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
			console.error(
				`[neynar-webhook-job] job ${job.id} ❌ Unable to get xmtp agent address`,
			);
			return {
				status: "failed",
				error: "Unable to get xmtp agent address",
			};
		}
		progress = 10;
		await job.updateProgress(progress);

		// build copy trade action
		let sellToken = await getTokenInfoFromDb({
			tokenAddress: transaction.sellToken,
			chainId: transaction.chainId,
		});
		let buyToken = await getTokenInfoFromDb({
			tokenAddress: transaction.buyToken,
			chainId: transaction.chainId,
		});

		// get token info from onchain and save in db
		if (!sellToken || !buyToken) {
			const [sellTokenCodexInfo, buyTokenCodexInfo, onchainTokenInfo] =
				await Promise.all([
					getTokenInfoFromCodex(transaction.sellToken, transaction.chainId),
					getTokenInfoFromCodex(transaction.buyToken, transaction.chainId),
					getTokenInfo({
						sellTokenAddress: transaction.sellToken,
						buyTokenAddress: transaction.buyToken,
						chainId: transaction.chainId,
					}),
				]);

			if (!sellToken) {
				sellToken = await saveTokenInDb({
					id: `eip155:${transaction.chainId}:${transaction.sellToken}`,
					address: transaction.sellToken,
					chainId: transaction.chainId,
					symbol: sellTokenCodexInfo?.symbol ?? onchainTokenInfo.sellSymbol,
					name:
						sellTokenCodexInfo?.name ??
						onchainTokenInfo.sellSymbol ??
						"Unknown",
					decimals: sellTokenCodexInfo?.decimals,
					imageUrl: sellTokenCodexInfo?.info?.imageLargeUrl
						? sellTokenCodexInfo.info.imageLargeUrl
						: undefined,
				});
			}

			if (!buyToken) {
				buyToken = await saveTokenInDb({
					id: `eip155:${transaction.chainId}:${transaction.buyToken}`,
					address: transaction.buyToken,
					chainId: transaction.chainId,
					symbol: buyTokenCodexInfo?.symbol ?? onchainTokenInfo.buySymbol,
					name:
						buyTokenCodexInfo?.name ?? onchainTokenInfo.buySymbol ?? "Unknown",
					decimals:
						buyTokenCodexInfo?.decimals ?? onchainTokenInfo.tokenDecimals ?? 18,
					imageUrl: buyTokenCodexInfo?.info?.imageLargeUrl
						? buyTokenCodexInfo.info.imageLargeUrl
						: undefined,
				});
			}
		}

		// if still no token info, return error
		if (!sellToken || !buyToken) {
			console.error(
				`[neynar-webhook-job] job ${job.id} ❌ Unable to get token info`,
			);
			return {
				status: "failed",
				error: "Unable to get token info",
			};
		}
		const sellAmount = Number.parseFloat(transaction.sellAmount).toFixed(4);

		const actionMessage = `Copy trade @${userInDb.name}: Swap ${sellAmount} ${sellToken.symbol} for ${buyToken.symbol}`;

		// save user activity in db
		const { price: sellTokenPrice, fdv: sellFdv } = getTokenPriceAndFdv({
			amount: transaction.sellAmount,
			amountInUsd: transaction.sellAmountUsd,
			totalSupply: transaction.sellAmountTotSupply,
			digits: sellToken.decimals,
		});
		const { price: buyTokenPrice, fdv: buyFdv } = getTokenPriceAndFdv({
			amount: transaction.buyAmount,
			amountInUsd: transaction.buyAmountUsd,
			totalSupply: transaction.buyAmountTotSupply,
			digits: buyToken.decimals,
		});
		await saveUserActivityInDb({
			userId: userInDb.id,
			chainId: transaction.chainId,
			txHash: transaction.transactionHash,
			sellTokenId: sellToken.id,
			buyTokenId: buyToken.id,
			sellAmount: transaction.sellAmount,
			sellAmountUsd: transaction.sellAmountUsd,
			buyAmount: transaction.buyAmount,
			buyAmountUsd: transaction.buyAmountUsd,
			sellAmountTotSupply: transaction.sellAmountTotSupply,
			buyAmountTotSupply: transaction.buyAmountTotSupply,
			sellFdv: sellFdv.toString(),
			buyFdv: buyFdv.toString(),
			sellTokenPrice: sellTokenPrice.toString(),
			buyTokenPrice: buyTokenPrice.toString(),
			rawTransaction: rawTransaction ?? undefined,
		});

		// save group activity in db
		const groupActivities = groups.map((group) => ({
			id: ulid(),
			groupId: group.groupId,
			activityChainId: transaction.chainId,
			activityTxHash: transaction.transactionHash,
		}));
		await saveActivityForMultipleGroups(groupActivities);

		// generate og image for the transaction
		const ogImageRes = await fetch(
			`${env.APP_URL}/api/og/c/${transaction.chainId}/tx/${transaction.transactionHash}`,
			{
				headers: {
					"x-api-secret": env.API_KEY_SECRET,
				},
			},
		);
		if (!ogImageRes.ok) {
			console.error(
				`[neynar-webhook-job] job ${job.id} ❌ Unable to generate og image for tx ${transaction.transactionHash} on chain ${transaction.chainId}`,
			);
		}
		const ogImage = await ogImageRes.json();
		console.log(
			`[neynar-webhook-job] job ${job.id} Og image generated for tx ${transaction.transactionHash} on chain ${transaction.chainId}`,
			ogImage,
		);

		// build copy trade action
		const action = await getXmtpCopyTradeAction({
			actionMessage,
			transaction,
			userUsername: userInDb.name,
			agentAddress: agentAddress as Address,
		});
		progress = 15;
		await job.updateProgress(progress);
		console.log(
			`[neynar-webhook-job] job ${job.id} Building copy trade action`,
		);

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
				console.error(
					`[neynar-webhook-job] job ${job.id} ❌ Unable to get conversation`,
				);
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
				`[neynar-webhook-job] job ${job.id} Copy trade action sent to the group chat ${conversation.id}`,
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
		console.error(`[neynar-webhook-job] job ${job.id} failed:`, error);
		throw error;
	}
};
