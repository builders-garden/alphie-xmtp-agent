import { ContentTypeWalletSendCalls } from "@xmtp/content-type-wallet-send-calls";
import { parseUnits } from "viem";
import { base } from "viem/chains";
import { ACTIONS_MESSAGE, USDC_NETWORKS } from "./lib/constants.js";
import { env } from "./lib/env.js";
import {
	ActionBuilder,
	type ERC20Handler,
	registerAction,
} from "./utils/index.js";

function createERC20Transfer({
	fromAddress,
	amount,
	erc20Handler,
	agentAddress,
}: {
	fromAddress: string;
	amount: number;
	erc20Handler: ERC20Handler;
	agentAddress: string;
}) {
	const amountInDecimals = parseUnits(
		amount.toString(),
		USDC_NETWORKS[base.id].decimals,
	);
	const calls = erc20Handler.createTransferWithApproveCalls({
		fromAddress: fromAddress as `0x${string}`,
		recipientAddress: agentAddress as `0x${string}`,
		amount,
		amountInDecimals,
		tokenAddress: USDC_NETWORKS[base.id].tokenAddress,
		tokenDecimals: USDC_NETWORKS[base.id].decimals,
		chainId: base.id,
		networkId: "base-mainnet",
		networkName: base.name,
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
	registerAction("send-usdc", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;

		const transfer = createERC20Transfer({
			fromAddress: senderAddress,
			amount: 0.005,
			erc20Handler,
			agentAddress,
		});
		await ctx.conversation.send(transfer, ContentTypeWalletSendCalls);
		await ctx.sendText("💸 Send USDC from your wallet!");
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

export const getXmtpActions = () => {
	return ActionBuilder.create("help", ACTIONS_MESSAGE)
		.add("send-usdc", "💸 Send USDC")
		.add("balance", "💰 Your Balance")
		.add("open-app", "😉 Open App")
		.build();
};
