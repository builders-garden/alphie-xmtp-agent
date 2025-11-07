import { and, countDistinct, eq, inArray, or } from "drizzle-orm";
import { group, groupTrackedUser } from "../db.schema.js";
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
export const getGroupsTrackingUserByUserId = async (
	userId: string,
	groupId?: string,
) => {
	if (!userId) {
		return [];
	}
	const whereClause = groupId
		? eq(groupTrackedUser.groupId, groupId)
		: eq(groupTrackedUser.userId, userId);
	return await db.query.groupTrackedUser.findMany({
		where: whereClause,
		with: {
			group: true,
		},
	});
};

/**
 * Get groups tracking a user by Farcaster FID
 * @param fid - The Farcaster FID of the user
 * @param groupId - Optional group id to filter by
 * @returns The groups tracking the user
 */
export const getGroupsTrackingUserByFarcasterFid = async (
	fid: number,
	groupId?: string,
) => {
	if (fid < 0) {
		console.error(`[getGroupsTrackingUserByFarcasterFid] Invalid fid ${fid}`);
		return [];
	}
	const user = await getUserByFarcasterFid(fid);
	if (!user) {
		console.error(
			`[getGroupsTrackingUserByFarcasterFid] User not found for fid ${fid}`,
		);
		return [];
	}
	return getGroupsTrackingUserByUserId(user.id, groupId);
};
