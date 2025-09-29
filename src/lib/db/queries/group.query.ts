import {
	type GroupMember,
	IdentifierKind,
	type Group as XmtpGroup,
} from "@xmtp/agent-sdk";
import { and, eq, inArray } from "drizzle-orm";
import {
	type CreateGroup,
	type CreateGroupMember,
	type Group,
	groupMemberTable,
	groupTable,
	type UpdateGroup,
} from "../db.schema.js";
import { db } from "../index.js";
import { getOrCreateUserByInboxId, getUsersByInboxIds } from "./user.query.js";

/**
 * Get group by id
 * @param conversationId - The group conversation id
 * @returns The group
 */
export const getGroupByConversationId = async (conversationId: string) => {
	const group = await db.query.groupTable.findFirst({
		where: eq(groupTable.conversationId, conversationId),
		with: {
			members: {
				with: {
					user: true,
				},
			},
		},
	});
	return group;
};

/**
 * Create group
 * @param group - The group to create
 * @returns The created group
 */
export const createGroup = async (group: CreateGroup) => {
	const [newGroup] = await db.insert(groupTable).values(group).returning();
	return newGroup;
};

/**
 * Update group
 * @param group - The group to update
 * @returns The updated group
 */
export const updateGroup = async (group: UpdateGroup) => {
	if (!group.id) {
		console.error("Group ID is required for this group", group);
		throw new Error("Group ID is required");
	}
	const [updatedGroup] = await db
		.update(groupTable)
		.set(group)
		.where(eq(groupTable.id, group.id))
		.returning();
	return updatedGroup;
};

/**
 * Upsert members for a group based on inboxIds
 */
export const upsertGroupMembers = async (
	groupId: string,
	members: GroupMember[],
) => {
	if (members.length === 0) return;

	// Ensure all users exist for given inboxIds
	const users = await Promise.all(
		members.map(async (member) => {
			const address = member.accountIdentifiers.find(
				(i) => i.identifierKind === IdentifierKind.Ethereum,
			)?.identifier;
			const user = await getOrCreateUserByInboxId(member.inboxId, address);
			return user;
		}),
	);

	const rows: CreateGroupMember[] = users.map((u) => ({
		groupId,
		userId: u.id,
	}));

	// Insert ignoring duplicates via unique index (groupId,userId)
	await db.insert(groupMemberTable).values(rows).onConflictDoNothing();
};

/**
 * Replace group members to match the provided inboxIds
 */
export const replaceGroupMembers = async (
	groupId: string,
	members: { inboxId: string; address?: string }[],
) => {
	// Get or create users for provided inboxIds
	const users = await Promise.all(
		members.map((member) =>
			getOrCreateUserByInboxId(member.inboxId, member.address),
		),
	);
	const userIds = users.map((u) => u.id);

	// Delete members not in new set in a single transaction
	await db.transaction(async (tx) => {
		await tx
			.delete(groupMemberTable)
			.where(and(eq(groupMemberTable.groupId, groupId)));

		// Reinsert all current members
		if (userIds.length > 0) {
			await tx
				.insert(groupMemberTable)
				.values(userIds.map((uid) => ({ groupId, userId: uid })))
				.onConflictDoNothing();
		}
	});
};

/**
 * Remove group members by inboxIds
 */
export const removeGroupMembersByInboxIds = async (
	groupId: string,
	inboxIds: string[],
) => {
	if (inboxIds.length === 0) return;
	const users = await getUsersByInboxIds(inboxIds);
	const userIds = users.map((u) => u.id);
	if (userIds.length === 0) return;
	await db
		.delete(groupMemberTable)
		.where(
			and(
				eq(groupMemberTable.groupId, groupId),
				inArray(groupMemberTable.userId, userIds),
			),
		);
};

/**
 * Get or create group by conversation id
 * @param conversationId - The group conversation id
 * @param xmtpGroup - The XMTP group
 * @returns The group and whether it is new
 */
export const getOrCreateGroupByConversationId = async (
	conversationId: string,
	xmtpGroup: XmtpGroup,
): Promise<{ group: Group; isNew: boolean }> => {
	const group = await getGroupByConversationId(conversationId);
	if (!group) {
		const newGroup = await createGroup({
			conversationId,
			name: xmtpGroup.name,
			description: xmtpGroup.description,
			imageUrl: xmtpGroup.imageUrl,
		});
		const members = await xmtpGroup.members();
		await upsertGroupMembers(newGroup.id, members);
		return { group: newGroup, isNew: true };
	}
	return { group, isNew: false };
};
