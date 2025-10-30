import { type CreateGroupActivity, groupActivity } from "../db.schema.js";
import { db } from "../index.js";

/**
 *
 * @param data - The data to save the group activities
 * @returns The saved group activities
 */
export const saveActivityForMultipleGroups = async (
	data: CreateGroupActivity[],
) => {
	const activities = await db.insert(groupActivity).values(data).returning();
	return activities;
};
