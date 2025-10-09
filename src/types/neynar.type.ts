import type {
	Webhook,
	WebhookSubscription,
	WebhookSubscriptionFilters,
} from "@neynar/nodejs-sdk/build/api/index.js";
import * as z from "zod";

/**
 * New subscription filter for the trade.created event
 */
export const tradeCreatedSubscriptionFilterSchema = z.object({
	fids: z.array(z.number()),
	minimum_trader_neynar_score: z.number(),
	minimum_token_amount_usdc: z.number(),
});

/**
 * Extended webhook subscription filters including trade.created.
 * Other existing keys from the SDK are typed as unknown to avoid duplication.
 */
export const neynarWebhookSubscriptionFiltersSchema = z
	.custom<WebhookSubscriptionFilters>()
	.and(
		z.object({
			"trade.created": tradeCreatedSubscriptionFilterSchema,
		}),
	);

export const neynarWebhookSubscriptionSchema = z
	.custom<WebhookSubscription>()
	.and(
		z.object({
			filters: neynarWebhookSubscriptionFiltersSchema,
		}),
	);

export const neynarWebhookSchema = z.custom<Webhook>().and(
	z.object({
		subscription: neynarWebhookSubscriptionSchema,
	}),
);

export const neynarWebhookFailureSchema = z.object({
	code: z.string(),
	message: z.string(),
	property: z.string(),
	status: z.number(),
});

export const neynarWebhookSuccessSchema = z.object({
	message: z.string(),
	success: z.literal(true),
	webhook: neynarWebhookSchema,
});
export type NeynarWebhookSuccessResponse = z.infer<
	typeof neynarWebhookSuccessSchema
>;

export const neynarWebhookResponseSchema = z.union([
	neynarWebhookSuccessSchema,
	neynarWebhookFailureSchema,
]);
export type NeynarWebhookResponse = z.infer<typeof neynarWebhookResponseSchema>;

/**
 * Trade created event
 */
export const userDehydratedSchema = z.object({
	object: z.literal("user_dehydrated"),
	fid: z.number(),
	score: z.number(),
});

export const tokenBalanceSchema = z.object({
	object: z.literal("token_balance"),
	token: z.object({
		object: z.literal("token"),
		address: z.string(),
		decimals: z.number(),
		symbol: z.string(),
		name: z.string(),
	}),
	balance: z.object({
		in_usdc: z.number().nullable(),
		in_token: z.string().nullable(),
	}),
});

export const poolSchema = z.object({
	object: z.literal("pool"),
	address: z.string(),
	protocol_family: z.string().optional(),
	protocol_version: z.string().optional(),
});

export const tradeWebhookPayloadSchema = z.object({
	type: z.literal("trade.created"),
	data: z.object({
		object: z.literal("trade"),
		trader: userDehydratedSchema.nullable(),
		pool: poolSchema,
		transaction: z.object({
			hash: z.string(),
			network: z.object({
				object: z.literal("network"),
				name: z.string(),
			}),
			net_transfer: z.object({
				object: z.literal("net_transfer"),
				receiving_token: tokenBalanceSchema,
				sending_token: tokenBalanceSchema,
			}),
		}),
	}),
});

export type TradeWebhookPayload = z.infer<typeof tradeWebhookPayloadSchema>;
