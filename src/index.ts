import { Agent } from "@xmtp/agent-sdk";
import { logDetails } from "@xmtp/agent-sdk/debug";
import {
	WalletSendCallsCodec,
	ContentTypeWalletSendCalls,
} from "@xmtp/content-type-wallet-send-calls";
import { ReplyCodec } from "@xmtp/content-type-reply";
import {
	inlineActionsMiddleware,
	firstTimeInteractionMiddleware,
} from "./middlewares.js";
import {
	USDCHandler,
	registerAction,
	ActionBuilder,
	sendActions,
	getEncryptionKeyFromString,
} from "./utils/index.js";
import { ActionsCodec, IntentCodec } from "./types/index.js";
import { base } from "viem/chains";
import { env } from "./lib/env.js";
import { GroupUpdatedMessage } from "./types/xmtp.types.js";

async function main() {
	// Initialize USDC handler
	const usdcHandler = new USDCHandler(base.id);
	const networkConfig = usdcHandler.getNetworkConfig();

	console.log(`📡 Connected to: ${networkConfig.networkName}`);
	console.log(`💰 USDC Address: ${networkConfig.tokenAddress}`);

	// Create agent using environment variables
	const agent = await Agent.createFromEnv({
		env: env.XMTP_ENV,
		dbEncryptionKey: env.XMTP_DB_ENCRYPTION_KEY
			? getEncryptionKeyFromString(env.XMTP_DB_ENCRYPTION_KEY)
			: undefined,
		dbPath: (inboxId: string) =>
			`${env.RAILWAY_VOLUME_MOUNT_PATH}/${env.XMTP_ENV}-${inboxId.slice(
				0,
				8,
			)}.db3`,
		codecs: [
			new ReplyCodec(),
			new WalletSendCallsCodec(),
			new ActionsCodec(),
			new IntentCodec(),
		],
	});

	const agentAddress = agent.address;
	if (!agentAddress) {
		throw new Error("Unable to get agent address");
	}

	// Helper function to create simple USDC transfer
	function createUSDCTransfer(
		fromAddress: string,
		amount: number,
		withMetadata: boolean = false,
	) {
		if (!agentAddress) {
			throw new Error("Unable to get agent address");
		}
		const amountInDecimals = Math.floor(
			amount * Math.pow(10, networkConfig.decimals),
		);
		const calls = usdcHandler.createUSDCTransferCalls(
			fromAddress,
			agentAddress,
			amountInDecimals,
		);

		// Add rich metadata if requested
		if (withMetadata) {
			calls.calls[0].metadata = {
				description: `Transfer ${amount} USDC`,
				transactionType: "transfer",
				currency: "USDC",
				amount: amountInDecimals.toString(),
				decimals: networkConfig.decimals.toString(),
				hostname: "tba.chat",
				faviconUrl:
					"https://www.google.com/s2/favicons?sz=256&domain_url=https%3A%2F%2Fwww.coinbase.com%2Fwallet",
				title: "TBA Chat Agent",
			};
		}

		return calls;
	}

	// Register action handlers focused on inline actions UX
	registerAction("send-small", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;

		const transfer = createUSDCTransfer(senderAddress, 0.005);
		await ctx.conversation.send(transfer, ContentTypeWalletSendCalls);
		await ctx.sendText(
			"💸 Please approve the 0.005 USDC transfer in your wallet!",
		);
	});

	registerAction("send-large", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;

		const transfer = createUSDCTransfer(senderAddress, 1);
		await ctx.conversation.send(transfer, ContentTypeWalletSendCalls);
		await ctx.sendText("💸 Please approve the 1 USDC transfer in your wallet!");
	});

	registerAction("check-balance", async (ctx) => {
		const balance = await usdcHandler.getUSDCBalance(agentAddress);
		await ctx.sendText(
			`💰 Bot Balance: ${balance} USDC on ${networkConfig.networkName}`,
		);
	});

	registerAction("send-with-metadata", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;

		const transfer = createUSDCTransfer(senderAddress, 0.005, true);
		await ctx.conversation.send(transfer, ContentTypeWalletSendCalls);
		await ctx.sendText(
			"😉 Please approve the 0.005 USDC transfer with rich metadata!",
		);
	});

	registerAction("transaction-actions", async (ctx) => {
		const actions = ActionBuilder.create(
			"transaction-actions",
			"Choose a transaction action:",
		)
			.add("send-small", "Send 0.005 USDC")
			.add("send-large", "Send 1 USDC")
			.add("send-with-metadata", "Send with Metadata")
			.add("check-balance", "Check Balance")
			.build();

		await sendActions(ctx, actions);
	});

	registerAction("more-info", async (ctx) => {
		const infoMessage = `ℹ️ Network Information

CURRENT NETWORK:
• Name: ${networkConfig.networkName}
• Chain ID: ${networkConfig.chainId}
• USDC Address: ${networkConfig.tokenAddress}

FEATURES:
• Wallet Send Calls (EIP-5792)
• Inline Actions (XIP-67)

🔗 Test at: https://xmtp.chat`;

		await ctx.sendText(infoMessage);
	});

	// Agent middlewares
	agent.use(firstTimeInteractionMiddleware, inlineActionsMiddleware);

	// Handle text messages with simple commands
	agent.on("text", async (ctx) => {
		if (!ctx.message.content.startsWith("/")) return;

		if (ctx.isDm()) {
			const welcomeActions = ActionBuilder.create(
				`welcome-${Date.now()}`,
				`👋 Welcome! I'm your ETH price agent.\n\nI can help you stay updated with the latest Ethereum price information. Choose an option below to get started:`,
			)
				.add("get-current-price", "💰 Get Current ETH Price")
				.add("get-price-chart", "📊 Get Price with 24h Change")
				.build();

			console.log(`✓ Sending welcome message with actions`);
			await sendActions(ctx, welcomeActions);
		}

		const actions = ActionBuilder.create(
			"help",
			`👋 Welcome to Alphie XMTP Agent!

I can help you with USDC transactions on ${networkConfig.networkName}.

Choose an action below:`,
		)
			.add("transaction-actions", "💸 Transaction Actions")
			.add("send-with-metadata", "😉 Send with Metadata")
			.add("check-balance", "Check Balance")
			.add("more-info", "ℹ️ More Info")
			.build();

		await sendActions(ctx, actions);
	});

	agent.on("reply", async (ctx) => {
		console.log("↩️ Reply received:", ctx.message.content);
	});

	agent.on("reaction", async (ctx) => {
		console.log("👍 Reaction received:", ctx.message.content);
	});

	agent.on("message", async (ctx) => {
		console.log(`💬 Message received: ${JSON.stringify(ctx.message.content)}`);

		if (ctx.message.contentType?.typeId === "reply") {
			console.log("↩️ Reply already handled:");
			return;
		}

		if (ctx.message.contentType?.typeId === "reaction") {
			console.log("👍 Reaction not supported:");
			return;
		}

		// Check if message is a group update
		if (ctx.message.contentType?.typeId === "group_updated") {
			const msg = ctx.message as GroupUpdatedMessage;

			// track member additions
			if (msg.content.addedInboxes?.length ?? 0 > 0) {
				console.log("New members added:", msg.content.addedInboxes);
			}

			// track member removals
			if (msg.content.removedInboxes?.length ?? 0 > 0) {
				console.log("Members removed:", msg.content.removedInboxes);
			}

			// track metadata changes
			const hasChangedName = msg.content.metadataFieldChanges?.find(
				(c) => c.fieldName === "group_name",
			);
			const hasChangedDescription = msg.content.metadataFieldChanges?.find(
				(c) => c.fieldName === "group_description",
			);
			const hasChangedImageUrl = msg.content.metadataFieldChanges?.find(
				(c) => c.fieldName === "group_image_url_square",
			);
			if (hasChangedName || hasChangedDescription || hasChangedImageUrl) {
				console.log(
					"Group metadata changed:",
					msg.content.metadataFieldChanges,
				);
			}
		}
	});

	// Handle startup
	agent.on("start", () => {
		console.log(`🦊 Alphie XMTP Agent is running...`);
		console.log(`Send /help or gm to get started!`);
		logDetails(agent.client);
	});

	// Start the agent
	await agent.start();
}

main().catch(console.error);
