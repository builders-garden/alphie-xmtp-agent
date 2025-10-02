import type { Request, Response } from "express";
import type { Address } from "viem";
import { getGroupsTrackingUserByFarcasterFid } from "../../lib/db/queries/tracking.query.js";
import { env } from "../../lib/env.js";
import { createXmtpAgent } from "../../lib/xmtp/agent.js";
import {
	ContentTypeActions,
	handleCopyTradeSchema,
} from "../../types/index.js";
import { getTokenInfo, getXmtpCopyTradeAction } from "../../utils/index.js";

/**
 * Handle copy trade controller
 * @param req - The request object
 * @param res - The response object
 * @returns void
 */
export const handleCopyTrade = async (req: Request, res: Response) => {
	try {
		const parseBody = handleCopyTradeSchema.safeParse(req.body);
		if (!parseBody.success) {
			console.error("Invalid request body", parseBody.error.message);
			res.status(400).json({
				status: "error",
				error: "Invalid request",
			});
			return;
		}

		const { user, transaction } = parseBody.data;

		// get groups that are tracking the user
		const groups = await getGroupsTrackingUserByFarcasterFid(user.fid);
		if (groups.length === 0) {
			console.log("No groups found");
			res.status(200).json({
				status: "success",
				message: "No groups are tracking the given user",
			});
			return;
		}

		// instantiate xmtp agent
		const xmtpAgent = await createXmtpAgent();
		await xmtpAgent.client.conversations.sync();

		const agentAddress = xmtpAgent.address;
		if (!agentAddress) {
			console.error("❌ Unable to get xmtp agent address");
			res.status(500).json({
				status: "error",
				error: "Unable to get xmtp agent address",
			});
			return;
		}

		// build copy trade action
		const token = await getTokenInfo({
			sellTokenAddress: transaction.sellToken,
			buyTokenAddress: transaction.buyToken,
			chainId: transaction.chainId,
		});
		const sellAmount = Number.parseFloat(transaction.sellAmount).toFixed(2);
		const actionMessage = `Copy trade @${user.username}: Swap ${sellAmount} ${token.sellSymbol} for ${token.buySymbol}`;
		const action = getXmtpCopyTradeAction({
			actionMessage,
			transaction,
			agentAddress: agentAddress as Address,
		});

		// iterate over groups and send copy trade message
		for (const group of groups) {
			const conversation =
				await xmtpAgent.client.conversations.getConversationById(
					group.group.conversationId,
				);
			if (!conversation) {
				console.error("❌ Unable to get conversation");
				res.status(500).json({
					status: "error",
					error: "Unable to get conversation",
				});
				return;
			}

			// send copy trade action to the group chat
			await conversation.send(action, ContentTypeActions);
			await conversation.send(
				`See more details here ${env.APP_URL}/t/${transaction.transactionHash}`,
			);
			console.log(
				`Copy trade action sent to the group chat ${conversation.id}`,
			);
		}

		res.status(200).json({
			status: "success",
			message: "Copy trade handled successfully",
		});
	} catch (error) {
		console.error("Error handling copy trade", error);
		res.status(500).json({
			status: "error",
			error: "Internal server error",
		});
	}
};
