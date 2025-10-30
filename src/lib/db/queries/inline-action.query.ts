import { eq } from "drizzle-orm";
import {
	type CreateInlineAction,
	type InlineAction,
	inlineAction,
} from "../db.schema.js";
import { db } from "../index.js";

/**
 * Create a durable inline action
 * @param record - The durable inline action record to create
 */
export async function createInlineAction(record: CreateInlineAction) {
	return await db.insert(inlineAction).values(record).onConflictDoNothing();
}

/**
 * Get an inline action by its ID
 * @param id - The ID of the inline action to get
 * @returns The inline action, or undefined if not found
 */
export async function getInlineActionById(
	id: string,
): Promise<InlineAction | undefined> {
	const rows = await db
		.select()
		.from(inlineAction)
		.where(eq(inlineAction.id, id))
		.limit(1);
	return rows[0];
}
