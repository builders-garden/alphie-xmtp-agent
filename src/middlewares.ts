import type { AgentMiddleware } from "@xmtp/agent-sdk";
import type { IntentContent } from "./types/intent-content.js";
import type { InlineActionsContext } from "./types/xmtp.types.js";
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
				// Attach params to context for handlers that need them
				(ctx as InlineActionsContext).metadata = intentContent.metadata;
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
