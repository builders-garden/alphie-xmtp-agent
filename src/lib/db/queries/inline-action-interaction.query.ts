import { eq } from "drizzle-orm";
import {
	type CreateInlineActionInteraction,
	inlineActionInteraction,
	type UpdateInlineActionInteraction,
} from "../db.schema.js";
import { db } from "../index.js";

/**
 * Store a user interaction to an inline action
 * @param record - The user interaction record to store
 * @returns The created inline action interaction
 */
export async function createInlineActionInteraction(
	record: CreateInlineActionInteraction
) {
	const [interaction] = await db
		.insert(inlineActionInteraction)
		.values(record)
		.onConflictDoNothing()
		.returning();
	return interaction;
}

/**
 * Update an inline action interaction
 * @param id - The ID of the inline action interaction to update
 * @param record - The inline action interaction record to update
 * @returns
 */
export async function updateInlineActionInteraction(
	id: string,
	record: UpdateInlineActionInteraction
) {
	const [updatedInteraction] = await db
		.update(inlineActionInteraction)
		.set(record)
		.where(eq(inlineActionInteraction.id, id))
		.returning();
	return updatedInteraction;
}
