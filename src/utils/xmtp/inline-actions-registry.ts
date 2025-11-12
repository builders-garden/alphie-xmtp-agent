import type { MessageContext } from "@xmtp/agent-sdk";
import {
	createInlineAction,
	getInlineActionById,
} from "../../lib/db/queries/inline-action.query.js";
import type {
	DurableActionPayloadMap,
	DurableActionRecord,
	DurableActionType,
	DurableHandler,
} from "../../types/xmtp.types.js";

// ---- Handlers ----
const durableHandlers: { [K in DurableActionType]: DurableHandler<K> } = {
	copytrade: async (ctx, payload) => {
		const { handleCopyTrade } = await import("./xmtp-actions.util.js");
		await handleCopyTrade(ctx, payload);
	},
	start_tracking: async (ctx, payload) => {
		const { updateUsersToQueue } = await import("../queue.util.js");
		const job = await updateUsersToQueue({
			addUsers: [payload],
		});
		console.log(`[ai-sdk] Job added to add users queue: ${job.id}`);
		await ctx.sendText("User added to group trackings!");
	},
};

// ---- API ----

/**
 * Register a durable action
 * @param record - The durable action record to register
 */
export async function registerDurableAction<T extends DurableActionType>(
	record: DurableActionRecord<T>
) {
	await createInlineAction({
		id: record.id,
		type: record.type,
		payload: record.payload as unknown as object,
		expiresAt: record.expiresAt,
		createdAt: new Date(),
	});
}

/**
 * Handle a durable action by its ID
 * @param ctx - The message context
 * @param actionId - The ID of the action to handle
 * @returns True if the action was handled, false otherwise
 */
export async function handleDurableActionById(
	ctx: MessageContext,
	actionId: string
): Promise<boolean> {
	const inlineAction = await getInlineActionById(actionId);
	if (!inlineAction) {
		console.error(`❌ Inline action ${actionId} not found`);
		return false;
	}

	// expired
	if (inlineAction.expiresAt && new Date(inlineAction.expiresAt) < new Date()) {
		console.warn(`⚠️ Action ${actionId} expired`);
		return false;
	}

	const handler = durableHandlers[inlineAction.type as DurableActionType] as
		| DurableHandler<DurableActionType>
		| undefined;
	if (!handler) {
		console.error(`❌ Durable handler for action ${actionId} not found`);
		return false;
	}

	await handler(
		ctx,
		inlineAction.payload as DurableActionPayloadMap[DurableActionType]
	);
	return true;
}
