import { Agent, filter } from "@xmtp/agent-sdk";
import { logDetails } from "@xmtp/agent-sdk/debug";
import { GroupUpdatedCodec } from "@xmtp/content-type-group-updated";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import { RemoteAttachmentCodec } from "@xmtp/content-type-remote-attachment";
import { ReplyCodec } from "@xmtp/content-type-reply";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";
import { base } from "viem/chains";
import { getXmtpActions, registerXmtpActions } from "./actions.js";
import { aiGenerateAnswer } from "./lib/ai-sdk.js";
import {
	DM_RESPONSE_MESSAGE,
	HELP_HINT_MESSAGE,
	WELCOME_MESSAGE,
} from "./lib/constants.js";
import { getOrCreateGroupByConversationId } from "./lib/db/queries/index.js";
import { env } from "./lib/env.js";
import {
	firstTimeInteractionMiddleware,
	inlineActionsMiddleware,
} from "./middlewares.js";
import { ActionsCodec, IntentCodec } from "./types/index.js";
import type { GroupUpdatedMessage } from "./types/xmtp.types.js";
import {
	ERC20Handler,
	getEncryptionKeyFromString,
	sendActions,
} from "./utils/index.js";
import {
	extractMessageContent,
	handleGroupUpdated,
	shouldRespondToMessage,
	shouldSendHelpHint,
} from "./utils/message.util.js";

async function main() {
	console.log("🦊 Alphie XMTP Agent started 🗿");
	console.log(`📡 Connected to: ${base.name}`);

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

	// get agent address
	const agentAddress = agent.address;
	if (!agentAddress) {
		console.error("❌ Unable to get xmtp agent address");
		throw new Error("Unable to get xmtp agent address");
	}

	// Initialize ERC20 handler
	const erc20Handler = new ERC20Handler();
	// Register action handlers focused on inline actions UX
	registerXmtpActions({ erc20Handler, agentAddress });

	// Agent middlewares
	agent.use(firstTimeInteractionMiddleware, inlineActionsMiddleware);

	agent.on("message", async (ctx) => {
		console.log(`💬 Message received: ${JSON.stringify(ctx.message.content)}`);

		try {
			// skip if message has no content or is from the agent or its a reaction
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

				if (isNew) {
					console.log("Sending welcome message to new group");
					await ctx.sendText(WELCOME_MESSAGE);
					const actions = getXmtpActions({});
					await sendActions(ctx, actions);
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
						const actions = getXmtpActions({});
						await sendActions(ctx, actions);
						return;
					}

					// get conversation history
					const xmtpMessages = await ctx.conversation.messages({
						limit: 100,
					});

					const answer = await aiGenerateAnswer({
						message: messageContent,
						xmtpContext: ctx,
						xmtpMessages,
					});
					if (answer) {
						await ctx.sendText(answer);
					}
				}
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("❌ Error processing message:", errorMessage);
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
