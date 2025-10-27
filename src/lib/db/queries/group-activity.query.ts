import { and, eq } from "drizzle-orm";
import { type CreateGroupActivity, groupActivity } from "../db.schema.js";
import { db } from "../index.js";

/**
 * Save a group activity to the database
 * @param data - The data to save the group activity
 * @returns The saved group activity
 */
export const saveGroupActivityInDb = async (data: CreateGroupActivity) => {
	const [activity] = await db.insert(groupActivity).values(data).returning();
	return activity;
};

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

/**
 * Get activity by tx hash
 * @param txHash - The tx hash
 * @returns The activity
 */
export const getActivityByTxHash = async (txHash: string, chainId: number) => {
	const activity = await db.query.groupActivity.findFirst({
		where: and(
			eq(groupActivity.txHash, txHash),
			eq(groupActivity.chainId, chainId),
		),
	});
	return activity;
};
