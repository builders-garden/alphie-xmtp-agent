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
import {
	addUsersToGroupTrackings,
	removeUsersFromGroupTrackings,
} from "./tracking.query.js";
import {
	getOrCreateUserByInboxId,
	getOrCreateUsersByInboxIds,
	getUsersByInboxIds,
} from "./user.query.js";

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
 * Delete group by id
 * @param groupId - The group id
 */
export const deleteGroupById = async (groupId: string) => {
	return await db.delete(groupTable).where(eq(groupTable.id, groupId));
};

/**
 * Upsert members for a group based on inboxIds
 */
export const upsertGroupMembers = async (
	groupId: string,
	membersRaw: GroupMember[],
	_agentAddress: string,
	agentInboxId: string,
) => {
	// filter out the agent from the members
	const members = membersRaw.filter((m) => m.inboxId !== agentInboxId);
	if (members.length === 0) return;

	// Ensure all users exist for given inboxIds
	const data = members.map((m) => ({
		inboxId: m.inboxId,
		address: m.accountIdentifiers.find(
			(i) => i.identifierKind === IdentifierKind.Ethereum,
		)?.identifier,
	}));
	const users = await getOrCreateUsersByInboxIds(data);

	const rows: CreateGroupMember[] = users.map((u) => ({
		groupId,
		userId: u.id,
	}));

	// Insert ignoring duplicates via unique index (groupId,userId)
	await db.insert(groupMemberTable).values(rows).onConflictDoNothing();

	// add users to group trackings
	await addUsersToGroupTrackings(rows);
};

/**
 * Add group members by inboxIds (idempotent)
 */
export const addGroupMembersByInboxIds = async (
	groupId: string,
	members: { inboxId: string; address?: string }[],
): Promise<void> => {
	if (members.length === 0) return;
	// Ensure user s exist (creating as needed)
	const users = await Promise.all(
		members.map((member) =>
			getOrCreateUserByInboxId(member.inboxId, member.address),
		),
	);
	const rows: CreateGroupMember[] = users.map((u) => ({
		groupId,
		userId: u.id,
	}));
	// Insert, ignoring duplicates
	await db.insert(groupMemberTable).values(rows).onConflictDoNothing();

	// add users to group trackings
	await addUsersToGroupTrackings(rows);
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

	// remove members from group tracked users
	await removeUsersFromGroupTrackings(groupId, userIds);

	// remove members from group members
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
	agentAddress: string,
	agentInboxId: string,
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
		await upsertGroupMembers(newGroup.id, members, agentAddress, agentInboxId);
		return { group: newGroup, isNew: true };
	}
	return { group, isNew: false };
};
