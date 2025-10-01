import { ContentTypeWalletSendCalls } from "@xmtp/content-type-wallet-send-calls";
import { type Address, type Hex, parseUnits } from "viem";
import { get0xQuote } from "../lib/0x-api.js";
import {
	ACTIONS_MESSAGE,
	HELP_HINT_MESSAGE,
	MIN_0X_SWAP_AMOUNT,
} from "../lib/constants.js";
import { env } from "../lib/env.js";
import type { HandleCopyTradeSchema } from "../types/index.js";
import {
	getBalance,
	getEstimatedGasFee,
	getEthBalance,
	swapERC20,
} from "../utils/index.js";
import {
	ActionBuilder,
	buildCopyTradeAction,
	registerAction,
} from "./index.js";

/**
 * Register XMTP actions
 * @param erc20Handler - The ERC20 handler
 */
export const registerXmtpActions = () => {
	registerAction("open-app", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;

		await ctx.sendText(`💸  app in your wallet! ${env.APP_URL}`);
	});

	registerAction("leaderboard", async (ctx) => {
		// TODO: get leaderboard
		const leaderboard = "1. @alice: 100\n2. @bob: 90\n3. @charlie: 80";
		await ctx.sendText(`🏆 Leaderboard of the group\n\n${leaderboard}`);
	});

	registerAction("help", async (ctx) => {
		await ctx.sendText(HELP_HINT_MESSAGE);
	});
};

/**
 * Get XMTP actions
 * @returns The actions
 */
export const getXmtpActions = () => {
	return ActionBuilder.create("help", ACTIONS_MESSAGE)
		.add({ id: "leaderboard", label: "🏆 Leaderboard" })
		.add({ id: "open-app", label: "😉 Open App" })
		.add({ id: "help", label: "💬 Help" })
		.build();
};

/**
 * Get XMTP copy trade action for a transaction
 * @param actionMessage - The action message
 * @param transaction - The transaction
 * @returns The action to copy trade
 */
export const getXmtpCopyTradeAction = ({
	actionMessage,
	transaction,
}: {
	actionMessage: string;
	transaction: HandleCopyTradeSchema["transaction"];
}) => {
	const action = buildCopyTradeAction({
		message: actionMessage,
		transactionHash: transaction.transactionHash,
		onCopyTrade: async (ctx) => {
			const senderAddress = await ctx.getSenderAddress();
			if (!senderAddress) {
				console.error("❌ Unable to get sender address");
				await ctx.sendText("❌ Unable to get sender address");
				return;
			}
			console.log(
				`Copy trade of ${transaction.transactionHash} on ${transaction.chainId}`,
			);

			// check if a user has enough balance of the sell token
			const [tokenBalance, ethBalance, gasEstimate] = await Promise.all([
				getBalance({
					tokenAddress: transaction.sellToken,
					address: senderAddress as Address,
					chainId: transaction.chainId,
				}),
				getEthBalance({
					address: senderAddress as Address,
					chainId: transaction.chainId,
				}),
				getEstimatedGasFee({ chainId: transaction.chainId }),
			]);
			console.log(
				"copy trade action",
				JSON.stringify({
					senderAddress,
					tokenBalance,
					ethBalance,
					gasEstimate,
				}),
			);
			let sellAmount = Number.parseFloat(transaction.sellAmount);
			const sellAmountInDecimals = parseUnits(
				transaction.sellAmount,
				tokenBalance.tokenDecimals,
			);
			console.log(
				"sellAmount",
				JSON.stringify({
					sellAmount,
					sellAmountInDecimals: sellAmountInDecimals.toString(),
				}),
			);

			// user eth balance is lower than the gas estimate
			const hasEnoughEth =
				Number.parseFloat(ethBalance.balanceRaw) >
				Number.parseFloat(gasEstimate.maxFeePerGas);
			const hasEnoughToken =
				Number.parseFloat(tokenBalance.balanceRaw) >= sellAmountInDecimals;
			const hasSomeToken =
				Number.parseFloat(tokenBalance.balanceRaw) >= MIN_0X_SWAP_AMOUNT;
			console.log(
				"check balances",
				JSON.stringify({
					hasEnoughEth,
					hasEnoughToken,
					hasSomeToken,
				}),
			);

			if (!hasEnoughEth) {
				console.error(
					`❌ User does not have enough ETH on chain ${transaction.chainId}`,
				);
				await ctx.sendText(
					`❌ User does not have enough ETH on chain ${transaction.chainId}`,
				);
				return;
			}
			// if user balance is lower than the sell amount
			if (!hasEnoughToken) {
				// if user has no balance, return
				if (!hasSomeToken) {
					console.error("❌ User does not have enough balance");
					await ctx.sendText("❌ User does not have enough balance");
					return;
				}
				// if user has some token balance, use 50% of the balance for the swap
				sellAmount = (Number(tokenBalance.balanceRaw) * 50) / 100;
			}

			// get 0x quote
			const quote = await get0xQuote({
				...transaction,
				sellAmount: sellAmount.toString(),
				taker: senderAddress as Address,
			});
			if (quote.status === "nok") {
				console.error("❌ Unable to get quote");
				await ctx.sendText("❌ Unable to get quote");
				return;
			}

			// get swapERC20 calls
			const walletSendCalls = swapERC20({
				fromAddress: senderAddress as Address,
				to: quote.data.to as Address,
				data: quote.data.data as Hex,
				value: quote.data.value,
				chainId: transaction.chainId,
			});

			// send swap ERC20 calls
			await ctx.conversation.send(walletSendCalls, ContentTypeWalletSendCalls);
		},
	});
	return action;
};
