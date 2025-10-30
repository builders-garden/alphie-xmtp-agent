import type { MessageContext } from "@xmtp/agent-sdk";
import { ContentTypeId } from "@xmtp/content-type-primitives";
import type { Address } from "viem";
import z from "zod";
import type { QueueUser } from "./queue.type.js";
import type { HandleCopyTradeSchema } from "./server.type.js";

export interface GroupUpdatedMessage {
	conversationId: string;
	contentType: { typeId: "group_updated" };
	content: {
		metadataFieldChanges?: Array<{
			fieldName: string; // "group_name", "group_description", etc.
			oldValue: string;
			newValue: string;
		}>;
		addedInboxes?: Array<{
			inboxId: string; // New members added
		}>;
		removedInboxes?: Array<{
			inboxId: string; // Members removed
		}>;
		initiatedByInboxId?: string; // Who triggered the update
	};
}

// Extended context type to include inline actions metadata
export interface InlineActionsContext extends MessageContext {
	metadata?: Record<string, unknown>;
}

export interface ThinkingReactionContext extends MessageContext {
	helpers: {
		addThinkingEmoji: () => Promise<void>;
		removeThinkingEmoji: () => Promise<void>;
	};
}

// ---- CODECS ----

/**
 * Intent content structure
 * Users send this when they interact with actions
 */
export const intentContentSchema = z.object({
	id: z.string(),
	actionId: z.string(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});
export type IntentContent = z.infer<typeof intentContentSchema>;

/**
 * Content Type ID for Actions messages
 * Following XIP-67 specification for inline actions
 */
export const ContentTypeActions = new ContentTypeId({
	authorityId: "coinbase.com",
	typeId: "actions",
	versionMajor: 1,
	versionMinor: 0,
});

/**
 * Individual action definition
 */
export type Action = {
	/** Unique identifier for this action */
	id: string;
	/** Display text for the button */
	label: string;
	/** Optional image URL */
	imageUrl?: string;
	/** Optional visual style (primary|secondary|danger) */
	style?: "primary" | "secondary" | "danger";
	/** Optional metadata */
	metadata?: Record<string, unknown>;
	/** Optional ISO-8601 expiration timestamp */
	expiresAt?: string;
};

/**
 * Actions content structure
 * Agents use this to present interactive button options to users
 */
export type ActionsContent = {
	/** Unique identifier for these actions */
	id: string;
	/** Descriptive text explaining the actions */
	description: string;
	/** Array of action definitions */
	actions: Action[];
	/** Optional ISO-8601 expiration timestamp */
	expiresAt?: string;
};

// ---- ACTION HANDLERS ----
export type ActionHandler = (ctx: MessageContext) => Promise<void>;

export type DurableActionType = "copytrade" | "start_tracking";

export type DurableActionPayloadMap = {
	copytrade: {
		transaction: HandleCopyTradeSchema["transaction"];
		userUsername: string;
		agentAddress: Address;
	};
	start_tracking: QueueUser;
};

export type DurableActionRecord<
	TType extends DurableActionType = DurableActionType,
> = {
	id: string;
	type: TType;
	payload: DurableActionPayloadMap[TType];
	expiresAt?: Date;
};

export type DurableHandler<T extends DurableActionType> = (
	ctx: MessageContext,
	payload: DurableActionPayloadMap[T],
) => Promise<void>;
