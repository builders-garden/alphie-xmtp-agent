import type { MiniAppNotificationDetails } from "@farcaster/miniapp-sdk";
import { relations, sql } from "drizzle-orm";
import {
	foreignKey,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Better Auth Tables
 */
export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.default(false)
		.notNull(),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	token: text("token").notNull().unique(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: integer("access_token_expires_at", {
		mode: "timestamp_ms",
	}),
	refreshTokenExpiresAt: integer("refresh_token_expires_at", {
		mode: "timestamp_ms",
	}),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

/**
 * Better Auth Farcaster Plugin Tables
 */
export const walletAddress = sqliteTable("wallet_address", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	address: text("address").notNull().unique(),
	chainId: integer("chain_id").default(1), // ethereum mainnet
	isPrimary: integer("is_primary", { mode: "boolean" }).default(false),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
});

export const farcaster = sqliteTable("farcaster", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	inboxId: text("inbox_id").unique(),
	fid: integer("fid").notNull().unique(),
	username: text("username").notNull(),
	displayName: text("display_name"),
	avatarUrl: text("avatar_url"),
	notificationDetails: text("notification_details", {
		mode: "json",
	}).$type<MiniAppNotificationDetails | null>(),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

/**
 * Alphie Group Table
 */
export const group = sqliteTable(
	"group",
	{
		id: text("id").primaryKey().notNull(),
		conversationId: text("conversation_id").notNull(),
		name: text("name"),
		description: text("description"),
		imageUrl: text("image_url"),
		createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
		updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	},
	(t) => [uniqueIndex("group_conversation_id_unique_idx").on(t.conversationId)],
);

/**
 * Alphie Group Members (many-to-many: groups <-> users)
 */
export const groupMember = sqliteTable(
	"group_member",
	{
		id: text("id").primaryKey().notNull(),
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	},
	(t) => [
		uniqueIndex("group_member_group_user_unique_idx").on(t.groupId, t.userId),
	],
);

/**
 * Alphie Group Tracked Users (many-to-many: groups <-> users being tracked)
 */
export const groupTrackedUser = sqliteTable(
	"group_tracked_user",
	{
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		addedByUserId: text("added_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	},
	(t) => [
		primaryKey({ columns: [t.groupId, t.userId] }),
		uniqueIndex("group_tracked_user_group_user_unique_idx").on(
			t.groupId,
			t.userId,
		),
	],
);

/**
 * Alphie Tokens Table (save info about tokens on a specific chain)
 */
export const tokens = sqliteTable("tokens", {
	id: text("id").primaryKey().notNull(),
	address: text("address").notNull(),
	symbol: text("symbol").notNull(),
	name: text("name").notNull(),
	imageUrl: text("image_url"),
	decimals: integer("decimals", { mode: "number" }).notNull(),
	chainId: integer("chain_id", { mode: "number" }).notNull(),
	createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

/**
 * Alphie Group Activity (many-to-many: groups <-> users being tracked)
 */
export const groupActivity = sqliteTable(
	"group_activity",
	{
		id: text("id").primaryKey().notNull(),
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		chainId: integer("chain_id", { mode: "number" }).notNull(),
		txHash: text("tx_hash").notNull(),
		sellTokenId: text("sell_token_id")
			.notNull()
			.references(() => tokens.id, { onDelete: "cascade" }),
		buyTokenId: text("buy_token_id")
			.notNull()
			.references(() => tokens.id, { onDelete: "cascade" }),
		sellAmount: text("sell_amount").notNull(),
		buyAmount: text("buy_amount").notNull(),
		sellMarketCap: text("sell_market_cap").notNull(),
		buyMarketCap: text("buy_market_cap").notNull(),
		sellTokenPrice: text("sell_token_price").notNull(),
		buyTokenPrice: text("buy_token_price").notNull(),
		parentActivityId: text("parent_activity_id"), // auto reference for copy trading from the miniapp/xmtp chat
		createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	},
	(t) => [
		foreignKey({
			columns: [t.parentActivityId],
			foreignColumns: [t.id],
			name: "group_activity_parent_activity_id_fk",
		}),
	],
);

/**
 * Neynar Webhook Table
 */
export const neynarWebhook = sqliteTable("neynar_webhook", {
	id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
	neynarWebhookId: text("neynar_webhook_id").notNull().unique(),
	webhookUrl: text("webhook_url").notNull(),
	webhookName: text("webhook_name").default("Alphie webhook").notNull(),
	createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

/**
 * Drizzle Types
 */
export type User = typeof user.$inferSelect;
export type CreateUser = typeof user.$inferInsert;
export type UpdateUser = Partial<CreateUser>;

export type Group = typeof group.$inferSelect;
export type CreateGroup = typeof group.$inferInsert;
export type UpdateGroup = Partial<CreateGroup>;

export type GroupMember = typeof groupMember.$inferSelect;
export type CreateGroupMember = typeof groupMember.$inferInsert;

export type GroupTrackedUser = typeof groupTrackedUser.$inferSelect;
export type CreateGroupTrackedUser = typeof groupTrackedUser.$inferInsert;

export type WalletAddress = typeof walletAddress.$inferSelect;
export type CreateWalletAddress = typeof walletAddress.$inferInsert;
export type UpdateWalletAddress = Partial<CreateWalletAddress>;

export type Farcaster = typeof farcaster.$inferSelect;
export type CreateFarcaster = typeof farcaster.$inferInsert;
export type UpdateFarcaster = Partial<CreateFarcaster>;

export type Tokens = typeof tokens.$inferSelect;
export type CreateTokens = typeof tokens.$inferInsert;
export type UpdateTokens = Partial<CreateTokens>;

export type GroupActivity = typeof groupActivity.$inferSelect;
export type CreateGroupActivity = typeof groupActivity.$inferInsert;
export type UpdateGroupActivity = Partial<CreateGroupActivity>;

export type NeynarWebhook = typeof neynarWebhook.$inferSelect;

/**
 * Drizzle Relations
 */
export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	walletAddresses: many(walletAddress),
	farcasters: many(farcaster),
	groupMembers: many(groupMember),
	trackedInGroups: many(groupTrackedUser),
	trackingRequests: many(groupTrackedUser),
	activities: many(groupActivity),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

export const walletAddressRelations = relations(walletAddress, ({ one }) => ({
	user: one(user, {
		fields: [walletAddress.userId],
		references: [user.id],
	}),
}));

export const farcasterRelations = relations(farcaster, ({ one }) => ({
	user: one(user, {
		fields: [farcaster.userId],
		references: [user.id],
	}),
}));

export const groupRelations = relations(group, ({ many }) => ({
	members: many(groupMember),
	trackedUsers: many(groupTrackedUser),
}));

export const groupMemberRelations = relations(groupMember, ({ one }) => ({
	user: one(user, {
		fields: [groupMember.userId],
		references: [user.id],
	}),
	group: one(group, {
		fields: [groupMember.groupId],
		references: [group.id],
	}),
}));

export const groupTrackedUserRelations = relations(
	groupTrackedUser,
	({ one }) => ({
		group: one(group, {
			fields: [groupTrackedUser.groupId],
			references: [group.id],
		}),
		user: one(user, {
			fields: [groupTrackedUser.userId],
			references: [user.id],
		}),
		addedBy: one(user, {
			fields: [groupTrackedUser.addedByUserId],
			references: [user.id],
		}),
	}),
);
