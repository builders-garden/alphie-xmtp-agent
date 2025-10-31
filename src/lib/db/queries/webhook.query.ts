import { eq } from "drizzle-orm";
import type { NeynarWebhookSuccessResponse } from "../../../types/neynar.type.js";
import { type NeynarWebhook, neynarWebhook } from "../db.schema.js";
import { db } from "../index.js";

/**
 * Get a neynar webhook by ID from the database
 * @param neynarWebhookId - The ID of the neynar webhook to get
 * @returns The latest neynar webhook
 */
export const getNeynarWebhookByIdFromDb = async (
	neynarWebhookId: string,
): Promise<NeynarWebhook | undefined> => {
	const data = await db.query.neynarWebhook.findFirst({
		where: eq(neynarWebhook.neynarWebhookId, neynarWebhookId),
	});
	if (!data) {
		return undefined;
	}
	return data;
};

/**
 * Update a neynar webhook in the database
 * @param webhook - The neynar webhook to update
 * @returns The updated neynar webhook
 */
export const updateNeynarWebhookInDb = async (
	webhook: NeynarWebhookSuccessResponse,
) => {
	let trackedFids: number[] | undefined;
	let minimumTokenAmountUsdc: number | undefined;
	let minimumNeynarScore: number | undefined;

	// if the webhook is of type trade.created
	if ("trade.created" in webhook.webhook.subscription.filters) {
		trackedFids = webhook.webhook.subscription.filters["trade.created"].fids;
		minimumTokenAmountUsdc =
			webhook.webhook.subscription.filters["trade.created"]
				.minimum_token_amount_usdc;
		minimumNeynarScore =
			webhook.webhook.subscription.filters["trade.created"]
				.minimum_trader_neynar_score;
	}
	const data = await db
		.update(neynarWebhook)
		.set({
			neynarWebhookId: webhook.webhook.webhook_id,
			webhookUrl: webhook.webhook.target_url,
			trackedFids,
			minimumTokenAmountUsdc,
			minimumNeynarScore,
		})
		.where(eq(neynarWebhook.neynarWebhookId, webhook.webhook.webhook_id));
	return data;
};
