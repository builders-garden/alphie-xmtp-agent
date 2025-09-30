import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { ulid } from "ulid";

/**
 * User Table
 */
export const userTable = sqliteTable(
	"user",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ulid()),
		inboxId: text("inbox_id"),
		address: text("address"),
		ensName: text("ens_name"),
		baseName: text("base_name"),
		ensAvatarUrl: text("ens_avatar_url"),
		baseAvatarUrl: text("base_avatar_url"),
		farcasterFid: text("farcaster_fid"),
		farcasterAvatarUrl: text("farcaster_avatar_url"),
		farcasterUsername: text("farcaster_username"),
		farcasterDisplayName: text("farcaster_display_name"),
		createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
		updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	},
	(t) => [
		uniqueIndex("user_inbox_id_unique_idx").on(t.inboxId),
		uniqueIndex("user_address_unique_idx").on(t.address),
		uniqueIndex("user_farcaster_fid_unique_idx").on(t.farcasterFid),
	],
);

export type User = typeof userTable.$inferSelect;
export type CreateUser = typeof userTable.$inferInsert;
export type UpdateUser = Partial<CreateUser>;

/**
 * Group Table
 */
export const groupTable = sqliteTable(
	"group",
	{
		id: text("id")
			.primaryKey()
			.notNull()
			.$defaultFn(() => ulid()),
		conversationId: text("conversation_id").notNull(),
		name: text("name"),
		description: text("description"),
		imageUrl: text("image_url"),
		createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
		updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	},
	(t) => [uniqueIndex("group_conversation_id_unique_idx").on(t.conversationId)],
);

export type Group = typeof groupTable.$inferSelect;
export type CreateGroup = typeof groupTable.$inferInsert;
export type UpdateGroup = Partial<CreateGroup>;

/**
 * Group Members (many-to-many: groups <-> users)
 */
export const groupMemberTable = sqliteTable(
	"group_member",
	{
		id: text("id")
			.primaryKey()
			.notNull()
			.$defaultFn(() => ulid()),
		groupId: text("group_id")
			.notNull()
			.references(() => groupTable.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	},
	(t) => [
		uniqueIndex("group_member_group_user_unique_idx").on(t.groupId, t.userId),
	],
);

export type GroupMember = typeof groupMemberTable.$inferSelect;
export type CreateGroupMember = typeof groupMemberTable.$inferInsert;

/**
 * Message Table
 */
export const messageTable = sqliteTable(
	"message",
	{
		id: text("id")
			.primaryKey()
			.notNull()
			.$defaultFn(() => ulid()),
		xmtpMessageId: text("xmtp_message_id"),
		userId: text("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		groupId: text("group_id")
			.notNull()
			.references(() => groupTable.id, { onDelete: "cascade" }),
		content: text("content").notNull(),
		contentType: text("content_type"),
		sentAt: text("sent_at"),
		createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
		updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	},
	(t) => [
		uniqueIndex("message_xmtp_message_id_unique_idx").on(t.xmtpMessageId),
	],
);

export type Message = typeof messageTable.$inferSelect;
export type CreateMessage = typeof messageTable.$inferInsert;
export type UpdateMessage = Partial<CreateMessage>;

/**
 * Group Tracked Users (many-to-many: groups <-> users being tracked)
 */
export const groupTrackedUserTable = sqliteTable(
	"group_tracked_user",
	{
		id: text("id")
			.primaryKey()
			.notNull()
			.$defaultFn(() => ulid()),
		groupId: text("group_id")
			.notNull()
			.references(() => groupTable.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		addedByUserId: text("added_by_user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	},
	(t) => [
		uniqueIndex("group_tracked_user_group_user_unique_idx").on(
			t.groupId,
			t.userId,
		),
	],
);

export type GroupTrackedUser = typeof groupTrackedUserTable.$inferSelect;
export type CreateGroupTrackedUser = typeof groupTrackedUserTable.$inferInsert;

/**
 * Relations
 */
export const userRelations = relations(userTable, ({ many }) => ({
	messages: many(messageTable),
	groupMembers: many(groupMemberTable),
	trackedInGroups: many(groupTrackedUserTable),
	trackingRequests: many(groupTrackedUserTable),
}));

export const groupRelations = relations(groupTable, ({ many }) => ({
	messages: many(messageTable),
	members: many(groupMemberTable),
	trackedUsers: many(groupTrackedUserTable),
}));

export const messageRelations = relations(messageTable, ({ one }) => ({
	user: one(userTable, {
		fields: [messageTable.userId],
		references: [userTable.id],
	}),
	group: one(groupTable, {
		fields: [messageTable.groupId],
		references: [groupTable.id],
	}),
}));

export const groupMemberRelations = relations(groupMemberTable, ({ one }) => ({
	user: one(userTable, {
		fields: [groupMemberTable.userId],
		references: [userTable.id],
	}),
	group: one(groupTable, {
		fields: [groupMemberTable.groupId],
		references: [groupTable.id],
	}),
}));

export const groupTrackedUserRelations = relations(
	groupTrackedUserTable,
	({ one }) => ({
		group: one(groupTable, {
			fields: [groupTrackedUserTable.groupId],
			references: [groupTable.id],
		}),
		user: one(userTable, {
			fields: [groupTrackedUserTable.userId],
			references: [userTable.id],
		}),
		addedBy: one(userTable, {
			fields: [groupTrackedUserTable.addedByUserId],
			references: [userTable.id],
		}),
	}),
);
