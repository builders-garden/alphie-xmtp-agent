import { and, eq } from "drizzle-orm";
import { type CreateUserActivity, userActivity } from "../db.schema.js";
import { db } from "../index.js";

/**
 * Save a group activity to the database
 * @param data - The data to save the group activity
 * @returns The saved group activity
 */
export const saveUserActivityInDb = async (data: CreateUserActivity) => {
	const [activity] = await db
		.insert(userActivity)
		.values(data)
		.onConflictDoNothing()
		.returning();
	return activity;
};

/**
 * Get user activity by tx hash
 * @param params - The params
 * @param params.txHash - The tx hash
 * @param params.chainId - The chain id
 * @returns The user activity
 */
export const getUserActivityByTxHashAndChainId = async ({
	txHash,
	chainId,
}: {
	txHash: string;
	chainId: number;
}) => {
	const activity = await db.query.userActivity.findFirst({
		where: and(
			eq(userActivity.txHash, txHash),
			eq(userActivity.chainId, chainId)
		),
	});
	return activity;
};
