import { ContentTypeWalletSendCalls } from "@xmtp/content-type-wallet-send-calls";
import { parseUnits } from "viem";
import { base, mainnet } from "viem/chains";
import { ACTIONS_MESSAGE, USDC_NETWORKS } from "./lib/constants.js";
import { env } from "./lib/env.js";
import type { InlineActionsContext } from "./types/xmtp.types.js";
import {
	ActionBuilder,
	type ERC20Handler,
	registerAction,
} from "./utils/index.js";

function createERC20Transfer({
	fromAddress,
	recipientAddress,
	amount,
	tokenAddress,
	tokenDecimals,
	chainId,
	erc20Handler,
}: {
	fromAddress: string;
	recipientAddress: string;
	amount: number;
	tokenAddress: `0x${string}`;
	tokenDecimals: number;
	chainId: number;
	erc20Handler: ERC20Handler;
}) {
	console.log("createERC20Transfer this are the parameters:", {
		fromAddress,
		recipientAddress,
		amount,
		tokenAddress,
		tokenDecimals,
		chainId,
	});
	const amountInDecimals = parseUnits(amount.toString(), tokenDecimals);

	// Derive network metadata from chainId
	const chain = erc20Handler.getChain(chainId);
	const networkName = chain.name;
	const networkId =
		chainId === base.id
			? "base-mainnet"
			: chainId === mainnet.id
				? "ethereum-mainnet"
				: chain.name;

	const calls = erc20Handler.createTransferWithApproveCalls({
		fromAddress: fromAddress as `0x${string}`,
		recipientAddress: recipientAddress as `0x${string}`,
		amount,
		amountInDecimals,
		tokenAddress,
		tokenDecimals,
		chainId,
		networkId,
		networkName,
	});

	return calls;
}

/**
 * Register XMTP actions
 * @param erc20Handler - The ERC20 handler
 * @param agentAddress - The agent address
 */
export const registerXmtpActions = ({
	erc20Handler,
	agentAddress,
}: {
	erc20Handler: ERC20Handler;
	agentAddress: string;
}) => {
	registerAction("send-erc20", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;

		// Allow metadata via intent message
		const metadata = (ctx as InlineActionsContext).metadata;
		console.log("register xmtp action this are the metadata:", metadata);

		const recipientAddress = (metadata?.recipientAddress ||
			agentAddress) as string;
		let amount = 0.005;
		if (typeof metadata?.amount === "number") amount = metadata.amount;
		let chainId: number = base.id;
		if (typeof metadata?.chainId === "number") chainId = metadata.chainId;
		const tokenAddress = (metadata?.tokenAddress ||
			USDC_NETWORKS[chainId]?.tokenAddress ||
			USDC_NETWORKS[base.id].tokenAddress) as `0x${string}`;
		let tokenDecimals =
			USDC_NETWORKS[chainId]?.decimals || USDC_NETWORKS[base.id].decimals;
		if (typeof metadata?.tokenDecimals === "number")
			tokenDecimals = metadata.tokenDecimals;

		const transfer = createERC20Transfer({
			fromAddress: senderAddress,
			recipientAddress,
			amount,
			tokenAddress,
			tokenDecimals,
			chainId,
			erc20Handler,
		});
		await ctx.conversation.send(transfer, ContentTypeWalletSendCalls);
		await ctx.sendText("💸 Send ERC20 from your wallet!");
	});

	registerAction("open-app", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;

		await ctx.sendText(`💸  app in your wallet! ${env.APP_URL}`);
	});

	registerAction("balance", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;
		const balance = await erc20Handler.getBalance({
			tokenAddress: USDC_NETWORKS[base.id].tokenAddress,
			tokenDecimals: USDC_NETWORKS[base.id].decimals,
			address: senderAddress as `0x${string}`,
			chainId: base.id,
		});

		await ctx.sendText(`💰 Your Balance: ${balance} USDC on ${base.name}`);
	});
};

/**
 * Get XMTP actions to send erc20
 * @param sendERC20 - The send ERC20 action
 * @returns The actions
 */
export const getXmtpActions = ({
	sendERC20,
}: {
	sendERC20?: {
		recipientAddress: string;
		amount: number;
		tokenAddress: string;
		tokenDecimals: number;
		chainId: number;
	};
}) => {
	return ActionBuilder.create("help", ACTIONS_MESSAGE)
		.add({
			id: "send-erc20",
			label: "💸 Send ERC20",
			metadata: sendERC20
				? {
						recipientAddress: sendERC20.recipientAddress,
						amount: sendERC20.amount,
						tokenAddress: sendERC20.tokenAddress,
						tokenDecimals: sendERC20.tokenDecimals,
						chainId: sendERC20.chainId,
					}
				: undefined,
		})
		.add({ id: "balance", label: "💰 Your Balance" })
		.add({ id: "open-app", label: "😉 Open App" })
		.build();
};
