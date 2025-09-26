import { relations, sql } from "drizzle-orm";
import { text, sqliteTable } from "drizzle-orm/sqlite-core";
import { ulid } from "ulid";

/**
 * User Table
 */
export const userTable = sqliteTable("user", {
	address: text("address", { length: 42 }).primaryKey().notNull(),
	ensName: text("ens_name"),
	baseName: text("base_name"),
	ensAvatarUrl: text("ens_avatar_url"),
	baseAvatarUrl: text("base_avatar_url"),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => sql`now`),
	updatedAt: text("updated_at")
		.notNull()
		.$onUpdate(() => sql`now`),
});

export type User = typeof userTable.$inferSelect;
export type CreateUser = typeof userTable.$inferInsert;
export type UpdateUser = Partial<CreateUser>;

/**
 * Group Table
 */
export const groupTable = sqliteTable("group", {
	id: text("id", { length: 26 })
		.primaryKey()
		.$defaultFn(() => ulid()),
	name: text("name").notNull(),
	participants: text("participants", { length: 42 })
		.notNull()
		.references(() => userTable.address),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => sql`now`),
	updatedAt: text("updated_at")
		.notNull()
		.$onUpdate(() => sql`now`),
});

export type Group = typeof groupTable.$inferSelect;
export type CreateGroup = typeof groupTable.$inferInsert;
export type UpdateGroup = Partial<CreateGroup>;

/**
 * Message Table
 */
export const messageTable = sqliteTable("message", {
	id: text("id", { length: 26 })
		.primaryKey()
		.$defaultFn(() => ulid()),
	userId: text("user_id", { length: 26 }).notNull(),
	groupId: text("group_id", { length: 26 }).notNull(),
	content: text("content").notNull(),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => sql`now`),
	updatedAt: text("updated_at")
		.notNull()
		.$onUpdate(() => sql`now`),
});

export type Message = typeof messageTable.$inferSelect;
export type CreateMessage = typeof messageTable.$inferInsert;
export type UpdateMessage = Partial<CreateMessage>;

/**
 * Relations
 */
export const userRelations = relations(userTable, ({ many }) => ({
	messages: many(messageTable),
	groups: many(groupTable),
}));

export const groupRelations = relations(groupTable, ({ many }) => ({
	messages: many(messageTable),
}));

export const messageRelations = relations(messageTable, ({ one }) => ({
	user: one(userTable, {
		fields: [messageTable.userId],
		references: [userTable.address],
	}),
	group: one(groupTable, {
		fields: [messageTable.groupId],
		references: [groupTable.id],
	}),
}));
