import {
	type GroupMember,
	IdentifierKind,
	type Dm as XmtpDm,
	type Group as XmtpGroup,
} from "@xmtp/agent-sdk";
import { and, eq, inArray, or } from "drizzle-orm";
import { ulid } from "ulid";
import { updateUsersToQueue } from "../../../utils/queue.util.js";
import { XMTP_AGENTS } from "../../xmtp-agents.js";
import {
	type CreateGroup,
	type CreateGroupMember,
	type Group,
	group,
	groupMember,
	type UpdateGroup,
} from "../db.schema.js";
import { db } from "../index.js";
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
	const newGroup = await db.query.group.findFirst({
		where: eq(group.conversationId, conversationId),
		with: {
			members: {
				with: {
					user: true,
				},
			},
		},
	});
	return newGroup;
};

/**
 * Create group
 * @param newGroup - The group to create
 * @returns The created group
 */
export const createGroup = async (newGroup: CreateGroup) => {
	const [createdGroup] = await db.insert(group).values(newGroup).returning();
	return createdGroup;
};

/**
 * Update group
 * @param newGroup - The group to update
 * @returns The updated group
 */
export const updateGroup = async (newGroup: UpdateGroup) => {
	if (!newGroup.id) {
		console.error("Group ID is required for this group", newGroup);
		throw new Error("Group ID is required");
	}
	const [updatedGroup] = await db
		.update(group)
		.set(newGroup)
		.where(eq(group.id, newGroup.id))
		.returning();
	return updatedGroup;
};

/**
 * Delete group by id
 * @param groupId - The group id
 */
export const deleteGroupById = async (groupId: string) => {
	return await db.delete(group).where(eq(group.id, groupId));
};

/**
 * Upsert members for a group based on inboxIds
 */
export const upsertGroupMembers = async (
	groupId: string,
	membersRaw: GroupMember[],
	_agentAddress: string,
	agentInboxId: string
) => {
	// filter out the agent from the members
	const members = membersRaw.filter((m) => m.inboxId !== agentInboxId);
	if (members.length === 0) return;

	// Ensure all users exist for given inboxIds and the members are not in the XMTP agents list
	const data = members
		.map((m) => ({
			inboxId: m.inboxId,
			address: m.accountIdentifiers.find(
				(i) => i.identifierKind === IdentifierKind.Ethereum
			)?.identifier,
		}))
		.filter(
			(m) =>
				!XMTP_AGENTS.some(
					(a) => a.address.toLowerCase() === m.address?.toLowerCase()
				)
		);
	const users = await getOrCreateUsersByInboxIds(data);

	const rows: CreateGroupMember[] = users.map((u) => ({
		id: ulid(),
		groupId,
		userId: u.id,
	}));

	// Insert ignoring duplicates via unique index (groupId,userId)
	await db.insert(groupMember).values(rows).onConflictDoNothing();

	// add users to neynar webhook
	const usersToAdd = users
		.map((u) => ({
			fid: u.farcaster?.fid ?? -1,
			userId: u.id,
			groupId,
		}))
		.filter((u) => u.fid > -1);
	await updateUsersToQueue({ addUsers: usersToAdd });
};

/**
 * Add group members by inboxIds (idempotent)
 */
export const addGroupMembersByInboxIds = async (
	groupId: string,
	members: { inboxId: string; address?: string }[]
): Promise<void> => {
	if (members.length === 0) return;
	// Ensure user s exist (creating as needed)
	const users = await Promise.all(
		members.map((member) =>
			getOrCreateUserByInboxId(member.inboxId, member.address)
		)
	);
	const rows: CreateGroupMember[] = users
		.filter((u) => u !== null)
		.map((u) => ({
			id: ulid(),
			groupId,
			userId: u?.id ?? "",
		}));
	// Insert, ignoring duplicates
	await db.insert(groupMember).values(rows).onConflictDoNothing();

	// add users to neynar webhook
	if (users.length > 0) {
		const usersToAdd = users
			.filter((u) => u !== null)
			.map((u) => ({
				fid: u?.farcaster?.fid ?? -1,
				userId: u?.id ?? "",
				groupId,
			}))
			.filter((u) => u.fid > -1);
		await updateUsersToQueue({ addUsers: usersToAdd });
	}
};

/**
 * Remove group members by inboxIds
 */
export const removeGroupMembersByInboxIds = async (
	groupId: string,
	inboxIds: string[]
) => {
	if (inboxIds.length === 0) return;
	const users = await getUsersByInboxIds(inboxIds);
	const userIds = users.map((u) => u.id);
	if (userIds.length === 0) return;

	// remove users from neynar webhook
	const usersToRemove = users
		.map((u) => ({
			fid: u.farcaster?.fid ?? -1,
			userId: u.id,
			groupId,
		}))
		.filter((u) => u.fid > -1);
	await updateUsersToQueue({ removeUsers: usersToRemove });

	// remove members from group members
	await db
		.delete(groupMember)
		.where(
			and(
				eq(groupMember.groupId, groupId),
				inArray(groupMember.userId, userIds)
			)
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
	agentInboxId: string
): Promise<{ group: Group; isNew: boolean }> => {
	const group = await getGroupByConversationId(conversationId);
	if (!group) {
		const newGroup = await createGroup({
			id: ulid(),
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

/**
 * Get or create group by conversation id
 * @param conversationId - The group conversation id
 * @param xmtpDm - The XMTP dm
 * @returns The group and whether it is new
 */
export const getOrGroupByDmConversationId = async (
	conversationId: string,
	xmtpDm: XmtpDm,
	agentAddress: string,
	agentInboxId: string
): Promise<{ group: Group; isNew: boolean }> => {
	const group = await getGroupByConversationId(conversationId);
	if (!group) {
		const newGroup = await createGroup({
			id: ulid(),
			conversationId,
		});
		const members = await xmtpDm.members();
		await upsertGroupMembers(newGroup.id, members, agentAddress, agentInboxId);
		return { group: newGroup, isNew: true };
	}
	return { group, isNew: false };
};

/**
 * Resolve an input identifier (group id or conversation id) to a concrete group id
 * @param idOrConversationId - Either the `group.id` (ULID) or `group.conversationId`
 * @returns The resolved `group.id` or null if not found
 */
export const resolveGroupId = async (
	idOrConversationId: string
): Promise<string | null> => {
	if (!idOrConversationId) return null;
	// Try by group.id first
	const byId = await db.query.group.findFirst({
		where: or(
			eq(group.id, idOrConversationId),
			eq(group.conversationId, idOrConversationId)
		),
	});
	if (byId) {
		return byId.id;
	}
	return null;
};
