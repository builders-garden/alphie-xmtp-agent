import type { MessageContext } from "@xmtp/agent-sdk";
import { isAddress, isHex } from "viem";
import {
	type ActionHandler,
	type ActionsContent,
	ContentTypeActions,
} from "../../types/index.js";
import { ActionBuilder } from "./action-builder.js";

// IN MEMORY Action registry
export const actionHandlers = new Map<string, ActionHandler>();

/**
 * Register an action IN MEMORY
 * @param actionId - The id of the action
 * @param handler - The handler function for the action
 * @returns void
 */
export function registerAction(actionId: string, handler: ActionHandler): void {
	// Prevent overwriting existing handlers unless explicitly intended
	if (actionHandlers.has(actionId)) {
		console.warn(`⚠️ Action ${actionId} already registered, overwriting...`);
	}
	actionHandlers.set(actionId, handler);
}

/**
 * Send actions to the conversation
 * @param ctx - The message context
 * @param actionsContent - The actions content to send
 * @returns void
 */
export async function sendActions(
	ctx: MessageContext,
	actionsContent: ActionsContent,
): Promise<void> {
	await ctx.conversation.send(actionsContent, ContentTypeActions);
}

/**
 * Send a confirmation menu
 * @param ctx - The message context
 * @param message - The message to send
 * @param prevMessage - A previous message to send before the confirmation menu
 * @param onYes - The action to perform when the user clicks yes
 * @param onNo - The action to perform when the user clicks no
 * @returns void
 */
export async function sendConfirmation({
	ctx,
	prevMessage,
	message,
	onYes,
	onNo,
}: {
	ctx: MessageContext;
	prevMessage?: string;
	message: string;
	onYes: ActionHandler;
	onNo?: ActionHandler;
}): Promise<void> {
	const timestamp = Date.now();
	const yesId = `confirm-${timestamp}`;
	const noId = `cancel-${timestamp}`;

	registerAction(yesId, onYes);
	registerAction(
		noId,
		onNo ||
			(async (ctx) => {
				await ctx.sendText("❌ Cancelled");
			}),
	);

	if (prevMessage) {
		await ctx.sendTextReply(prevMessage);
	}
	await ActionBuilder.create(`confirm-${timestamp}`, message)
		.add({ id: yesId, label: "✅ Confirm" })
		.add({ id: noId, label: "❌ Cancel", style: "danger" })
		.send(ctx);
}

// Validation helpers
export const validators = {
	inboxId: (input: string) => {
		return isHex(input.trim()) && input.trim().length === 64
			? { valid: true }
			: { valid: false, error: "Invalid Inbox ID format (64 hex chars)" };
	},

	ethereumAddress: (input: string) => {
		return isAddress(input.trim())
			? { valid: true }
			: {
					valid: false,
					error: "Invalid Ethereum address format (0x + 40 hex chars)",
				};
	},
};
