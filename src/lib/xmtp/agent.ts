import { Agent, filter, type MessageContext } from "@xmtp/agent-sdk";
import type { GroupUpdated } from "@xmtp/content-type-group-updated";
import { GroupUpdatedCodec } from "@xmtp/content-type-group-updated";
import { MarkdownCodec } from "@xmtp/content-type-markdown";
import type { Reaction } from "@xmtp/content-type-reaction";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import {
	type ReadReceipt,
	ReadReceiptCodec,
} from "@xmtp/content-type-read-receipt";
import type { RemoteAttachment } from "@xmtp/content-type-remote-attachment";
import { RemoteAttachmentCodec } from "@xmtp/content-type-remote-attachment";
import type { Reply } from "@xmtp/content-type-reply";
import { ReplyCodec } from "@xmtp/content-type-reply";
import {
	type TransactionReference,
	TransactionReferenceCodec,
} from "@xmtp/content-type-transaction-reference";
import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";
import type {
	ActionsContent,
	GroupUpdatedMessage,
	IntentContent,
	ThinkingReactionContext,
} from "../../types/index.js";
import {
	getEncryptionKeyFromString,
	getXmtpActions,
	sendActions,
	sendTestNeynarTradeCreatedWebhook,
} from "../../utils/index.js";
import { ActionsCodec } from "../../utils/xmtp/actions-codec.js";
import { IntentCodec } from "../../utils/xmtp/intent-content.js";
import {
	extractMessageContent,
	handleGroupUpdated,
	shouldRespondToMessage,
	shouldSendHelpHint,
} from "../../utils/xmtp/message.util.js";
import { aiGenerateAnswer } from "../ai-sdk/index.js";
import { DM_RESPONSE_MESSAGE, HELP_HINT_MESSAGE } from "../constants.js";
import { getOrCreateGroupByConversationId } from "../db/queries/index.js";
import { env } from "../env.js";

/**
 * Get the XMTP agent
 * @returns The XMTP agent
 */
export const createXmtpAgent = async () => {
	const dbEncryptionKey = env.XMTP_DB_ENCRYPTION_KEY
		? getEncryptionKeyFromString(env.XMTP_DB_ENCRYPTION_KEY)
		: undefined;
	const customDbPath = (inboxId: string) =>
		`${env.RAILWAY_VOLUME_MOUNT_PATH}/${env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`;

	return Agent.createFromEnv({
		env: env.XMTP_ENV,
		dbEncryptionKey,
		dbPath: customDbPath,
		codecs: [
			new ReplyCodec(),
			new GroupUpdatedCodec(),
			new WalletSendCallsCodec(),
			new ActionsCodec(),
			new IntentCodec(),
			new ReactionCodec(),
			new ReadReceiptCodec(),
			new RemoteAttachmentCodec(),
			new MarkdownCodec(),
			new TransactionReferenceCodec(),
		],
	});
};

/**
 * Handle XMTP message
 * @param ctx - The message context
 */
export const handleXmtpMessage = async (
	ctx: MessageContext<
		| string
		| IntentContent
		| Reply
		| WalletSendCallsParams
		| ActionsContent
		| GroupUpdated
		| ReadReceipt
		| Reaction
		| RemoteAttachment
		| TransactionReference
	>,
	agentAddress: string,
) => {
	try {
		const thinkingContext = ctx as ThinkingReactionContext;

		// skip if message has no content or is from the agent or its a reaction
		if (
			!filter.hasContent(ctx.message) ||
			filter.fromSelf(ctx.message, ctx.client) ||
			ctx.message.contentType?.typeId === "reaction"
		) {
			return;
		}

		// Auto-respond to DM messages
		if (ctx.isDm()) {
			console.log("✓ Handling DM message");
			if (ctx.usesCodec(TransactionReferenceCodec)) {
				return; // already handled by the transaction reference middleware
			}
			await thinkingContext.helpers.addThinkingEmoji();
			await ctx.sendText(DM_RESPONSE_MESSAGE);
			return;
		}

		// Handle group messages
		if (ctx.isGroup()) {
			if (ctx.usesCodec(TransactionReferenceCodec)) {
				return; // already handled by the transaction reference middleware
			}
			const conversationId = ctx.conversation.id;
			console.log(`[xmtp] Handling group message ${conversationId}`);
			const { group, isNew } = await getOrCreateGroupByConversationId(
				conversationId,
				ctx.conversation,
				agentAddress,
				ctx.client.inboxId,
			);
			console.log(`[xmtp] Group ${group.id} isNew: ${isNew}`);

			if (ctx.message.contentType?.typeId === "group_updated") {
				// Handle group updates
				console.log(
					`[xmtp] Group updated message received: ${JSON.stringify(ctx.message)}`,
				);
				const xmtpMessage = ctx.message as GroupUpdatedMessage;
				const xmtpMembers = await ctx.conversation.members();
				handleGroupUpdated({
					group,
					xmtpMessage,
					xmtpMembers,
					agentAddress,
					agentInboxId: ctx.client.inboxId,
				});
			}

			if (isNew) {
				// welcome message already handled in the "group" event listener
			}

			// Handle reply to the agent
			const messageContent = extractMessageContent(ctx.message);

			if (messageContent.toLowerCase() === "/test") {
				await thinkingContext.helpers.addThinkingEmoji();
				await sendTestNeynarTradeCreatedWebhook(group.id);
				return;
			}

			const isSendHelpHint = shouldSendHelpHint(messageContent);
			const shouldRespond = await shouldRespondToMessage({
				message: ctx.message,
				agentInboxId: ctx.client.inboxId,
				agentAddress,
				client: ctx.client,
			});
			if (shouldRespond) {
				await thinkingContext.helpers.addThinkingEmoji();
				if (isSendHelpHint) {
					await ctx.sendTextReply(HELP_HINT_MESSAGE);
					const actions = getXmtpActions();
					await sendActions(ctx, actions);
					return;
				}

				// generate answer with tools
				const { answer, isReply } = await aiGenerateAnswer({
					message: messageContent,
					xmtpContext: ctx,
				});
				if (answer) {
					if (isReply) {
						await ctx.sendTextReply(answer);
					} else {
						await ctx.sendText(answer);
					}
				}
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("❌ Error processing message:", errorMessage);
	}
};
