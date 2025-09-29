import type { AgentMiddleware } from "@xmtp/agent-sdk";
import {
	ContentTypeReaction,
	type Reaction,
} from "@xmtp/content-type-reaction";
import type { IntentContent } from "./types/intent-content.js";
import type { ThinkingReactionContext } from "./types/xmtp.types.js";
import { actionHandlers } from "./utils/inline-actions.js";

/**
 * Middleware to detect first-time interactions and add flag to context
 */
export const firstTimeInteractionMiddleware: AgentMiddleware = async (
	ctx,
	next,
) => {
	const messages = await ctx.conversation.messages();
	const hasSentBefore = messages.some(
		(msg) =>
			msg.senderInboxId.toLowerCase() === ctx.client.inboxId.toLowerCase(),
	);
	const members = await ctx.conversation.members();
	const wasMemberBefore = members.some(
		(member: { inboxId: string; installationIds: string[] }) =>
			member.inboxId.toLowerCase() === ctx.client.inboxId.toLowerCase() &&
			member.installationIds.length > 1,
	);

	// Add the first-time interaction flag to the context
	if (!hasSentBefore && !wasMemberBefore) {
		console.warn("First time interaction");
		// return; // return to break the middleware chain and prevent the inline actions middleware from being executed
	} else {
		console.warn("Not first time interaction");
	}

	await next();
};

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
				await handler(ctx);
			} catch (error) {
				console.error("❌ Error in action handler:", error);
				await ctx.sendText(
					`❌ Error: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		} else {
			await ctx.sendText(`❌ Unknown action: ${intentContent.actionId}`);
		}
		return;
	}
	await next();
};

/**
 * Middleware to add and remove thinking emoji reaction
 * @param ctx
 * @param next
 */
export const thinkingReactionMiddleware: AgentMiddleware = async (
	ctx,
	next,
) => {
	try {
		// Step 1: Add thinking emoji reaction
		await ctx.conversation.send(
			{
				action: "added",
				content: "👀",
				reference: ctx.message.id,
				schema: "shortcode",
			} as Reaction,
			ContentTypeReaction,
		);

		// Step 2: Add helper function to remove the thinking emoji
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
		(ctx as ThinkingReactionContext).thinkingReaction = {
			removeThinkingEmoji,
		};

		// Continue to next middleware/handler
		await next();
	} catch (error) {
		console.error("Error in thinking reaction middleware:", error);
		// Continue anyway
		await next();
	}
};
