import type { AgentMiddleware } from "@xmtp/agent-sdk";
import type { InlineActionsContext, IntentContent } from "../../types/index.js";
import { actionHandlers } from "../../utils/index.js";

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
