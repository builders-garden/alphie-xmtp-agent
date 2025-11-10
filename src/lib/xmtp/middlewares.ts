import type { AgentMiddleware } from "@xmtp/agent-sdk";
import {
	ContentTypeReaction,
	type Reaction,
} from "@xmtp/content-type-reaction";
import {
	type TransactionReference,
	TransactionReferenceCodec,
} from "@xmtp/content-type-transaction-reference";
import { fromHex, isHex } from "viem";
import { base, mainnet } from "viem/chains";
import type {
	InlineActionsContext,
	IntentContent,
	ThinkingReactionContext,
} from "../../types/index.js";
import { actionHandlers } from "../../utils/index.js";
import { handleDurableActionById } from "../../utils/xmtp/inline-actions-registry.js";

/**
 * Middleware to handle intent messages and execute registered action handlers
 */
export const inlineActionsMiddleware: AgentMiddleware = async (ctx, next) => {
	if (ctx.message.contentType?.typeId === "intent") {
		const intentContent = ctx.message.content as IntentContent;
		const handler = actionHandlers.get(intentContent.actionId);

		console.log("🎯 Processing intent:", intentContent.actionId);
		if (handler) {
			try {
				// Attach params to context for handlers that need them
				(ctx as InlineActionsContext).metadata = intentContent.metadata;
				await handler(ctx);
			} catch (error) {
				console.error("❌ Error in action handler:", error);
			}
		} else {
			const handled = await handleDurableActionById(
				ctx,
				intentContent.actionId,
			);
			if (!handled) {
				console.error("❌ Unknown action:", intentContent.actionId);
			}
		}
		return;
	}
	await next();
};

/**
 * Middleware to add and remove thinking emoji reaction
 */
export const eyesReactionMiddleware: AgentMiddleware = async (ctx, next) => {
	try {
		// Step 1: Add helper function to add the eyes emoji reaction
		const addThinkingEmoji = async () => {
			await ctx.conversation.send(
				{
					action: "added",
					content: "👀",
					reference: ctx.message.id,
					schema: "shortcode",
				} as Reaction,
				ContentTypeReaction,
			);
		};

		// Step 2: Add helper function to remove the eyes emoji
		const removeThinkingEmoji = async () => {
			await ctx.conversation.send(
				{
					action: "removed",
					content: "👀",
					reference: ctx.message.id,
					schema: "shortcode",
				} as Reaction,
				ContentTypeReaction,
			);
		};

		// Attach helper to context
		(ctx as ThinkingReactionContext).helpers = {
			addThinkingEmoji,
			removeThinkingEmoji,
		};

		await next();
	} catch (error) {
		console.error("Error in thinking reaction middleware:", error);
		// Continue anyway
		await next();
	}
};

/** Transaction Reference */
export const transactionReferenceMiddleware: AgentMiddleware = async (
	ctx,
	next,
) => {
	// Check if this is a transaction reference message
	if (ctx.usesCodec(TransactionReferenceCodec)) {
		const senderAddress = await ctx.getSenderAddress();

		// expected from xmtp.chat
		let txRef: TransactionReference = ctx.message.content;
		if (!txRef.reference) {
			// transactionReference is nested in the message content by the base app
			if (
				typeof ctx.message.content === "object" &&
				"transactionReference" in ctx.message.content
			) {
				txRef = (
					ctx.message.content as unknown as {
						transactionReference: TransactionReference;
					}
				).transactionReference;
			}
		}
		if (!txRef.reference) {
			console.error(
				"❌ Transaction reference message received but no reference found",
				ctx.message,
			);
			await next();
		}

		console.log(
			`[tx-reference-middleware] tx reference message received from ${senderAddress} ${txRef.reference} network ${txRef.networkId}`,
		);
		const networkId = isHex(txRef.networkId)
			? fromHex(txRef.networkId, "number")
			: txRef.networkId;
		const txHash = txRef.reference;
		const explorerUrl =
			networkId === base.id
				? `https://basescan.org/tx/${txHash}`
				: networkId === mainnet.id
					? `https://etherscan.io/tx/${txHash}`
					: undefined;

		await ctx.sendMarkdown(
			`✅ Transaction received! on Network: ${networkId} tx hash: ${txHash} ${explorerUrl ? `[View on explorer](${explorerUrl})` : ""}`,
		);

		// Don't continue to other handlers since we handled this message
		return;
	}

	// Continue to next middleware/handler
	await next();
};
