import { desc, eq } from "drizzle-orm";
import type { NeynarWebhookSuccessResponse } from "../../../types/neynar.type.js";
import { type NeynarWebhook, neynarWebhook } from "../db.schema.js";
import { db } from "../index.js";

/**
 * Get the latest neynar webhook
 * @returns The latest neynar webhook
 */
export const getLatestNeynarWebhookFromDb =
	async (): Promise<NeynarWebhook | null> => {
		const data = await db.query.neynarWebhook.findFirst({
			orderBy: desc(neynarWebhook.id),
		});
		if (!data) {
			return null;
		}
		return data;
	};

/**
 * Save a neynar webhook to the database
 * @param webhook - The neynar webhook to save
 * @returns The saved neynar webhook
 */
export const saveNeynarWebhookInDb = async (
	webhook: NeynarWebhookSuccessResponse,
) => {
	const data = await db
		.insert(neynarWebhook)
		.values({
			neynarWebhookId: webhook.webhook.webhook_id,
			webhookUrl: webhook.webhook.target_url,
		})
		.returning();
	if (data.length > 0) {
		return data[0];
	}
	return null;
};

/**
 * Update a neynar webhook in the database
 * @param webhook - The neynar webhook to update
 * @returns The updated neynar webhook
 */
export const updateNeynarWebhookInDb = async (
	webhook: NeynarWebhookSuccessResponse,
) => {
	const data = await db
		.update(neynarWebhook)
		.set({
			neynarWebhookId: webhook.webhook.webhook_id,
			webhookUrl: webhook.webhook.target_url,
		})
		.where(eq(neynarWebhook.neynarWebhookId, webhook.webhook.webhook_id));
	return data;
};
