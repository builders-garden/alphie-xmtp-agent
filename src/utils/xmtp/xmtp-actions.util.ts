import type { MessageContext } from "@xmtp/agent-sdk";
import { IdentifierKind } from "@xmtp/agent-sdk";
import { ContentTypeMarkdown } from "@xmtp/content-type-markdown";
import {
	ContentTypeWalletSendCalls,
	type WalletSendCallsParams,
} from "@xmtp/content-type-wallet-send-calls";
import { ulid } from "ulid";
import { type Address, type Hex, parseUnits } from "viem";
import { get0xQuote } from "../../lib/0x-api.js";
import { ACTIONS_MESSAGE, MIN_0X_SWAP_AMOUNT } from "../../lib/constants.js";
import { getGroupByConversationId } from "../../lib/db/queries/group.query.js";
import {
	createInlineActionInteraction,
	updateInlineActionInteraction,
} from "../../lib/db/queries/inline-action-interaction.query.js";
import { getUserByInboxId } from "../../lib/db/queries/user.query.js";
import { env } from "../../lib/env.js";
import type { HandleCopyTradeSchema } from "../../types/index.js";
import type { DurableActionPayloadMap } from "../../types/xmtp.types.js";
import { getTransactionData } from "../../utils/erc20.util.js";
import { ActionBuilder } from "./action-builder.js";
import { registerAction } from "./inline-actions.js";
import { registerDurableAction } from "./inline-actions-registry.js";
import { swapERC20 } from "./xmtp-calls.util.js";

/**
 * Register XMTP actions
 * @param erc20Handler - The ERC20 handler
 */
export const registerXmtpActions = () => {
	registerAction("start-tracking", async (ctx) => {
		await ctx.sendText(
			"🔍 Tag me (@alphie.base.eth) and tell me the farcaster username or FID of the user you want to track\n\nExamples:\nHey @alphie.base.eth start tracking user with fid 3"
		);
	});

	registerAction("open-app", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;

		await ctx.sendText(`💸 explore group stats on the app ${env.APP_URL}`);
	});
};

/**
 * Get XMTP actions
 * @param options - Optional configuration for the actions
 * @param options.message - Optional message to display with the actions
 * @param options.labels - Optional custom labels for the actions
 * @returns The actions
 */
export const getXmtpActions = (options?: {
	message?: string;
	labels?: {
		startTracking?: string;
		leaderboard?: string;
		openApp?: string;
		help?: string;
	};
}) => {
	const message = options?.message ?? ACTIONS_MESSAGE;
	const labels = options?.labels ?? {};

	return ActionBuilder.create("help", message)
		.add({
			id: "start-tracking",
			label: labels.startTracking ?? "🔍 Start Tracking",
		})
		.add({ id: "open-app", label: labels.openApp ?? "🦊 Open App" })
		.build();
};

/**
 * Get XMTP copy trade action for a transaction
 * @param actionMessage - The action message
 * @param transaction - The transaction
 * @returns The action to copy trade
 */
export const getXmtpCopyTradeAction = async ({
	actionMessage,
	transaction,
	userUsername,
	agentAddress,
}: {
	actionMessage: string;
	userUsername: string;
	transaction: HandleCopyTradeSchema["transaction"];
	agentAddress: Address;
}) => {
	const actionId = `copytrade-${transaction.chainId}-${transaction.transactionHash}`;

	const payload: DurableActionPayloadMap["copytrade"] = {
		transaction,
		userUsername,
		agentAddress,
	};

	await registerDurableAction<"copytrade">({
		id: actionId,
		type: "copytrade",
		payload,
	});

	return ActionBuilder.create(actionId, actionMessage)
		.add({ id: actionId, label: "💰 Copy Trade" })
		.build();
};

/**
 * Handle a copy trade durable action
 * @param ctx - The message context
 * @param payload - The payload of the durable action
 * @returns
 */
export async function handleCopyTrade(
	ctx: MessageContext,
	payload: DurableActionPayloadMap["copytrade"]
) {
	const { transaction, agentAddress, userUsername } = payload;
	const senderAddress = await ctx.getSenderAddress();
	if (!senderAddress) {
		const message = "❌ Unable to get sender address";
		console.error(message);
		await ctx.sendText(message);
		return;
	}
	const senderInboxId = await ctx.client.getInboxIdByIdentifier({
		identifier: senderAddress as Address,
		identifierKind: IdentifierKind.Ethereum,
	});
	if (!senderInboxId) {
		console.error("❌ Unable to get sender inbox id, skipping inline action ");
		return;
	}

	const user = await getUserByInboxId(senderInboxId);
	if (!user) {
		console.error(
			"❌ Unable to get user by inbox id, skipping inline action interaction"
		);
		return;
	}

	console.log(
		`Copy trade of ${transaction.transactionHash} on ${transaction.chainId}`
	);

	// check if a user has enough balance of the sell token
	const { tokenBalance, ethBalance, gasEstimate } = await getTransactionData({
		sellTokenAddress: transaction.sellToken,
		buyTokenAddress: transaction.buyToken,
		senderAddress: senderAddress as Address,
		chainId: transaction.chainId,
	});
	let sellAmount = Number.parseFloat(transaction.sellAmount);
	let sellAmountInDecimals = parseUnits(
		transaction.sellAmount,
		tokenBalance.tokenDecimals
	);
	const hasEnoughEth =
		Number.parseFloat(ethBalance.balanceRaw) >
		Number.parseFloat(gasEstimate.maxFeePerGas);
	const hasEnoughToken =
		BigInt(tokenBalance.balanceRaw) >= sellAmountInDecimals;
	const hasSomeToken =
		BigInt(tokenBalance.balanceRaw) >= BigInt(MIN_0X_SWAP_AMOUNT);
	// if user has some token balance, use 50% of the balance for the swap (base units)
	if (hasEnoughEth && !hasEnoughToken && hasSomeToken) {
		sellAmountInDecimals = BigInt(tokenBalance.balanceRaw) / BigInt(2);
		sellAmount =
			Number(sellAmountInDecimals) / 10 ** tokenBalance.tokenDecimals;
	}

	// save inline action interaction to db
	const interaction = await createInlineActionInteraction({
		id: ulid(),
		inlineActionId: `copytrade-${transaction.chainId}-${transaction.transactionHash}`,
		userId: user.id,
		txHash: transaction.transactionHash,
		chainId: transaction.chainId,
		userEthBalance: ethBalance.balanceRaw,
		userSellTokenBalance: tokenBalance.balanceRaw,
		gasEstimate: gasEstimate.maxFeePerGas,
		hasEnoughEth,
		hasEnoughToken,
		hasSomeToken,
		sellAmount: sellAmount.toString(),
		createdAt: new Date(),
	});

	console.log(
		`[xmtp-action copytrade] tx hash ${transaction.transactionHash} on chain ${transaction.chainId} has enough eth: ${hasEnoughEth}, has enough token: ${hasEnoughToken}, has some token: ${hasSomeToken}`
	);

	// if user does not have gas
	if (!hasEnoughEth) {
		const message = `❌ User does not have enough ETH on chain ${transaction.chainId} for wallet ${senderAddress}`;
		console.error(message);
		await ctx.sendText(message);
		return;
	}
	// if user balance is lower than the sell amount
	if (!hasEnoughToken) {
		// if user has no balance at all, return
		if (!hasSomeToken) {
			const message = `❌ User does not have enough balance of ${tokenBalance.sellSymbol} ${transaction.sellToken} for wallet ${senderAddress}`;
			console.error(message);
			await ctx.sendText(message);
			return;
		}
	}

	// get 0x quote
	const quote = await get0xQuote({
		...transaction,
		sellAmountInDecimals: sellAmountInDecimals.toString(),
		taker: senderAddress as Address,
		agentAddress: agentAddress,
	});
	if (quote.status === "nok") {
		const message = `❌ Unable to get quote from 0x api for the swap of ${tokenBalance.sellSymbol} to ${tokenBalance.buySymbol} on chain ${transaction.chainId} for wallet ${senderAddress}`;
		console.error(`${message} error ${quote.error}`);
		await ctx.sendText(message);
		return;
	}

	// save quote to db
	if (interaction?.id) {
		await updateInlineActionInteraction(interaction.id, {
			quote: quote.data,
		});
	}

	const walletSendCalls = swapERC20({
		fromAddress: senderAddress as Address,
		to: quote.data.to as Address,
		data: quote.data.data as Hex,
		value: quote.data.value,
		chainId: transaction.chainId,
		sellTokenSymbol: tokenBalance.sellSymbol,
		buyTokenSymbol: tokenBalance.buySymbol,
		tokenDecimals: tokenBalance.tokenDecimals,
		tokenAddress: transaction.sellToken,
		gas: quote.data.gas,
		spender: quote.data.allowanceTarget as Address,
		needsApprove: quote.data.needsApprove,
		sellAmount,
		sellAmountInDecimals,
	});

	// save wallet send calls to db
	if (interaction?.id) {
		await updateInlineActionInteraction(interaction.id, {
			walletSendCalls: JSON.stringify(walletSendCalls),
		});
	}

	const dm = await ctx.client.conversations.newDm(senderInboxId);
	await dm.send(
		walletSendCalls as unknown as WalletSendCallsParams,
		ContentTypeWalletSendCalls
	);

	const groupInDb = await getGroupByConversationId(ctx.conversation.id);
	const groupStr = groupInDb?.name
		? ` in the group [${groupInDb.name}](cbwallet://messaging/${ctx.conversation.id})`
		: "";
	await dm.send(
		`This transaction has been copied from the user @${userUsername}${groupStr}`,
		ContentTypeMarkdown
	);

	await ctx.conversation.send(
		`💸 Copy trade sent to you via DM, open [chat here](cbwallet://messaging/${agentAddress})`,
		ContentTypeMarkdown
	);
}
