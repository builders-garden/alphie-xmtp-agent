import { Agent, filter } from "@xmtp/agent-sdk";
import { logDetails } from "@xmtp/agent-sdk/debug";
import { GroupUpdatedCodec } from "@xmtp/content-type-group-updated";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { RemoteAttachmentCodec } from "@xmtp/content-type-remote-attachment";
import { ReplyCodec } from "@xmtp/content-type-reply";
import {
	ContentTypeWalletSendCalls,
	WalletSendCallsCodec,
} from "@xmtp/content-type-wallet-send-calls";
import { base } from "viem/chains";
import { aiGenerateAnswer } from "./lib/ai-sdk.js";
import {
	DM_RESPONSE_MESSAGE,
	HELP_HINT_MESSAGE,
	WELCOME_MESSAGE,
} from "./lib/constants.js";
import { getOrCreateGroupByConversationId } from "./lib/db/queries/group.query.js";
import { env } from "./lib/env.js";
import {
	// firstTimeInteractionMiddleware,
	inlineActionsMiddleware,
	// thinkingReactionMiddleware,
} from "./middlewares.js";
import { ActionsCodec, IntentCodec } from "./types/index.js";
import type {
	GroupUpdatedMessage,
	ThinkingReactionContext,
} from "./types/xmtp.types.js";
import {
	ActionBuilder,
	getEncryptionKeyFromString,
	registerAction,
	sendActions,
	USDCHandler,
} from "./utils/index.js";
import {
	extractMessageContent,
	handleGroupUpdated,
	shouldRespondToMessage,
	shouldSendHelpHint,
} from "./utils/message.util.js";

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
			new GroupUpdatedCodec(),
			new WalletSendCallsCodec(),
			new ActionsCodec(),
			new IntentCodec(),
			new ReactionCodec(),
			new RemoteAttachmentCodec(),
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
		withMetadata = false,
	) {
		if (!agentAddress) {
			throw new Error("Unable to get agent address");
		}
		const amountInDecimals = Math.floor(amount * 10 ** networkConfig.decimals);
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
	registerAction("copy-trade", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;

		const transfer = createUSDCTransfer(senderAddress, 0.005);
		await ctx.conversation.send(transfer, ContentTypeWalletSendCalls);
		await ctx.sendText("💸 Please copy the trade in your wallet!");
	});

	registerAction("open-app", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;

		await ctx.sendText("💸  app in your wallet! https://app.tba.chat");
	});

	registerAction("balance", async (ctx) => {
		const senderAddress = await ctx.getSenderAddress();
		if (!senderAddress) return;
		const balance = await usdcHandler.getUSDCBalance(senderAddress);

		await ctx.sendText(
			`💰 Your Balance: ${balance} USDC on ${networkConfig.networkName}`,
		);
	});

	// 	registerAction("send-with-metadata", async (ctx) => {
	// 		const senderAddress = await ctx.getSenderAddress();
	// 		if (!senderAddress) return;

	// 		const transfer = createUSDCTransfer(senderAddress, 0.005, true);
	// 		await ctx.conversation.send(transfer, ContentTypeWalletSendCalls);
	// 		await ctx.sendText(
	// 			"😉 Please approve the 0.005 USDC transfer with rich metadata!",
	// 		);
	// 	});

	// 	registerAction("transaction-actions", async (ctx) => {
	// 		const actions = ActionBuilder.create(
	// 			"transaction-actions",
	// 			"Choose a transaction action:",
	// 		)
	// 			.add("send-small", "Send 0.005 USDC")
	// 			.add("send-large", "Send 1 USDC")
	// 			.add("send-with-metadata", "Send with Metadata")
	// 			.add("check-balance", "Check Balance")
	// 			.build();

	// 		await sendActions(ctx, actions);
	// 	});

	// 	registerAction("more-info", async (ctx) => {
	// 		const infoMessage = `🌐 Network Information

	// CURRENT NETWORK:
	// • Name: ${networkConfig.networkName}
	// • Chain ID: ${networkConfig.chainId}
	// • USDC Address: ${networkConfig.tokenAddress}

	// FEATURES:
	// • Wallet Send Calls (EIP-5792)
	// • Inline Actions (XIP-67)

	// 🔗 Test at: https://xmtp.chat`;

	// 		await ctx.sendText(infoMessage);
	// 	});

	// Agent middlewares
	agent.use(
		// firstTimeInteractionMiddleware,
		inlineActionsMiddleware,
		// thinkingReactionMiddleware,
	);

	agent.on("message", async (ctx) => {
		const thinkingCtx = ctx as ThinkingReactionContext;
		console.log(`💬 Message received: ${JSON.stringify(ctx.message.content)}`);

		try {
			// skip if message has no content or is from self or is reaction
			if (
				!filter.hasContent(ctx.message) ||
				filter.fromSelf(ctx.message, ctx.client) ||
				ctx.message.contentType?.typeId === "reaction"
			) {
				console.log("Skipping message");
				return;
			}

			// Auto-respond to DM messages
			if (ctx.isDm()) {
				console.log("✓ Handling DM message");
				await ctx.sendText(DM_RESPONSE_MESSAGE);
				if (thinkingCtx.thinkingReaction?.removeThinkingEmoji) {
					await thinkingCtx.thinkingReaction.removeThinkingEmoji();
				}
				return;
			}

			// Handle group messages
			if (ctx.isGroup()) {
				console.log("Handling group message");
				const conversationId = ctx.conversation.id;
				const { group, isNew } = await getOrCreateGroupByConversationId(
					conversationId,
					ctx.conversation,
				);
				console.log("Group:", group, isNew);

				// Send welcome message to new group if it is new
				if (isNew) {
					console.log("Sending welcome message to new group");
					await ctx.sendText(WELCOME_MESSAGE);
					console.log("✓ Sent welcome message to new group");
				}

				// Check if message is a group update
				if (ctx.message.contentType?.typeId === "group_updated" && !isNew) {
					console.log(
						"🥶 Group updated message received",
						JSON.stringify(ctx.message),
					);
					const msg = ctx.message as GroupUpdatedMessage;
					handleGroupUpdated(msg);
					return;
				}

				// Handle reply to the agent
				const messageContent = extractMessageContent(ctx.message);
				const isSendHelpHint = shouldSendHelpHint(messageContent);
				const shouldRespond = await shouldRespondToMessage({
					message: ctx.message,
					agentInboxId: ctx.client.inboxId,
					client: ctx.client,
				});
				console.log("Should respond:", shouldRespond);
				if (shouldRespond) {
					if (isSendHelpHint) {
						await ctx.sendText(HELP_HINT_MESSAGE);
						const actions = ActionBuilder.create(
							"help",
							`👋 Welcome to Alphie XMTP Agent!

		I can help you tracking trades of the group members.

		Choose an action below:`,
						)
							.add("copy-trade", "💸 Copy Trade")
							.add("balance", "💰 Your Balance")
							.add("open-app", "😉 Open App")
							.build();

						await sendActions(ctx, actions);
						if (thinkingCtx.thinkingReaction?.removeThinkingEmoji) {
							await thinkingCtx.thinkingReaction.removeThinkingEmoji();
						}
						return;
					}

					// TODO get conversation history
					const answer = await aiGenerateAnswer({
						message: messageContent,
						messages: [],
					});
					await ctx.sendText(answer);
				}

				// TODO: Handle reply for the group
				if (ctx.message.contentType?.typeId === "reply") {
					console.log("↩️ Handling reply");
					await ctx.sendText("Handling reply");
					if (thinkingCtx.thinkingReaction?.removeThinkingEmoji) {
						await thinkingCtx.thinkingReaction.removeThinkingEmoji();
					}
					return;
				}
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("❌ Error processing message:", errorMessage);
			if (thinkingCtx.thinkingReaction?.removeThinkingEmoji) {
				try {
					await thinkingCtx.thinkingReaction.removeThinkingEmoji();
				} catch (removeError) {
					console.error("Error removing thinking emoji:", removeError);
				}
			}
		}
	});

	// Handle startup
	agent.on("start", () => {
		console.log("🦊 Alphie XMTP Agent is running...");
		console.log("Send /help or gm to get started!");
		logDetails(agent.client);
	});

	// Start the agent
	await agent.start();
}

main().catch(console.error);
