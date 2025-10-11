import { and, countDistinct, eq, inArray } from "drizzle-orm";
import { groupTrackedUser } from "../db.schema.js";
import { db } from "../index.js";
import { getGroupByConversationId } from "./group.query.js";
import { getUserByFarcasterFid, getUserByInboxId } from "./user.query.js";

/**
 * Add tracked user to group
 * @param groupId - The group id
 * @param userId - The user id
 * @param addedByUserId - The user id of the user who added the tracked user
 */
export const addUsersToGroupTrackings = async (
	rows: {
		groupId: string;
		userId: string;
		addedByUserId?: string;
	}[],
) => {
	return await db.insert(groupTrackedUser).values(rows).onConflictDoNothing();
};

/**
 * Add user to group trackings by Farcaster FID
 * @param conversationId - The group conversation id
 * @param userFid - The user id
 * @param addedByUserId - The user id of the user who added the tracked user
 */
export const addUserToGroupTrackingByFid = async ({
	conversationId,
	userFid,
	addedByUserInboxId,
}: {
	conversationId: string;
	userFid: number;
	addedByUserInboxId?: string;
}) => {
	const [group, user] = await Promise.all([
		getGroupByConversationId(conversationId),
		getUserByFarcasterFid(userFid),
	]);
	if (!group) {
		throw new Error("Group not found");
	}
	if (!user) {
		throw new Error("User not found");
	}
	let addedByUserId: string | undefined;
	if (addedByUserInboxId) {
		const addedByUser = await getUserByInboxId(addedByUserInboxId);
		if (addedByUser) {
			addedByUserId = addedByUser.id;
		}
	}
	return await addUsersToGroupTrackings([
		{
			groupId: group.id,
			userId: user.id,
			addedByUserId,
		},
	]);
};

/**
 * Remove users from group trackings
 * @param groupId - The group id
 * @param userIds - The user ids
 */
export const removeUsersFromGroupTrackings = async (
	groupId: string,
	userIds: string[],
) => {
	return await db
		.delete(groupTrackedUser)
		.where(
			and(
				eq(groupTrackedUser.groupId, groupId),
				inArray(groupTrackedUser.userId, userIds),
			),
		);
};

/**
 * Count how many groups track a user by Farcaster FID
 * @param fid - The Farcaster FID of the user
 * @returns The number of groups tracking the user
 */
export const countGroupsTrackingUserByFarcasterFid = async (fid: number) => {
	const user = await getUserByFarcasterFid(fid);
	if (!user) return 0;
	const rows = await db
		.select({ cnt: countDistinct(groupTrackedUser.groupId) })
		.from(groupTrackedUser)
		.where(eq(groupTrackedUser.userId, user.id));
	return rows[0]?.cnt ?? 0;
};

/**
 * Get groups tracking a user by user id
 * @param userId - The user id
 * @returns The groups tracking the user
 */
export const getGroupsTrackingUserByUserId = async (userId: string) => {
	if (!userId) return [];
	const data = await db.query.groupTrackedUser.findMany({
		where: eq(groupTrackedUser.userId, userId),
		with: {
			group: true,
		},
	});
	return data;
};

/**
 * Get groups tracking a user by Farcaster FID
 * @param fid - The Farcaster FID of the user
 * @returns The groups tracking the user
 */
export const getGroupsTrackingUserByFarcasterFid = async (fid: number) => {
	if (fid < 0) return [];
	const user = await getUserByFarcasterFid(fid);
	if (!user) return [];
	return getGroupsTrackingUserByUserId(user.id);
};
