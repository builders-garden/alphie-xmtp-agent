import { relations, sql } from "drizzle-orm";
import {
	foreignKey,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { FarcasterNotificationDetails } from "../../types/farcaster.type.js";
import type { DurableActionType } from "../../types/xmtp.types.js";

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
	role: text("role"),
	banned: integer("banned", { mode: "boolean" }).default(false),
	banReason: text("ban_reason"),
	banExpires: integer("ban_expires", { mode: "timestamp_ms" }),
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
	impersonatedBy: text("impersonated_by"),
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
	})
		.$type<FarcasterNotificationDetails[]>()
		.default([]),
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
 * Alphie User Activity (user <-> tx activity)
 */
export const userActivity = sqliteTable(
	"user_activity",
	{
		chainId: integer("chain_id", { mode: "number" }).notNull(),
		txHash: text("tx_hash").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		sellTokenId: text("sell_token_id")
			.notNull()
			.references(() => tokens.id, { onDelete: "cascade" }),
		buyTokenId: text("buy_token_id")
			.notNull()
			.references(() => tokens.id, { onDelete: "cascade" }),
		sellAmount: text("sell_amount").notNull(),
		sellAmountUsd: text("sell_amount_usd").notNull().default("0"),
		buyAmount: text("buy_amount").notNull(),
		buyAmountUsd: text("buy_amount_usd").notNull().default("0"),
		sellFdv: text("sell_fdv").notNull(),
		buyFdv: text("buy_fdv").notNull(),
		sellTokenPrice: text("sell_token_price").notNull(),
		buyTokenPrice: text("buy_token_price").notNull(),
		sellAmountTotSupply: text("sell_amount_tot_supply").default("0").notNull(),
		buyAmountTotSupply: text("buy_amount_tot_supply").default("0").notNull(),
		parentActivityChainId: integer("parent_activity_chain_id", {
			mode: "number",
		}),
		parentActivityTxHash: text("parent_activity_tx_hash"),
		createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	},
	(t) => [
		primaryKey({ columns: [t.chainId, t.txHash] }),
		foreignKey({
			columns: [t.parentActivityChainId, t.parentActivityTxHash],
			foreignColumns: [t.chainId, t.txHash],
			name: "group_activity_parent_activity_id_fk",
		}),
	],
);

/**
 * Alphie Group Activity (group <-> activity)
 */
export const groupActivity = sqliteTable("group_activity", {
	id: text("id").primaryKey().notNull(),
	groupId: text("group_id")
		.notNull()
		.references(() => group.id, { onDelete: "cascade" }),
	activityChainId: integer("activity_chain_id", { mode: "number" }),
	activityTxHash: text("activity_tx_hash"),
	createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

/**
 * Durable Inline Actions Table
 */
export const inlineAction = sqliteTable("inline_action", {
	id: text("id").primaryKey().notNull(),
	type: text("type").notNull().$type<DurableActionType>(),
	payload: text("payload", { mode: "json" }).notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

/**
 * Alphie Inline Action Interactions Table (user <-> many inline action interaction)
 */
export const inlineActionInteraction = sqliteTable(
	"inline_action_interaction",
	{
		id: text("id").primaryKey().notNull(),
		inlineActionId: text("inline_action_id")
			.notNull()
			.references(() => inlineAction.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		txHash: text("tx_hash").notNull(),
		chainId: integer("chain_id", { mode: "number" }).notNull(),
		userEthBalance: text("user_eth_balance"),
		userSellTokenBalance: text("user_sell_token_balance"),
		gasEstimate: text("gas_estimate"),
		hasEnoughEth: integer("has_enough_eth", { mode: "boolean" }),
		hasEnoughToken: integer("has_enough_token", { mode: "boolean" }),
		hasSomeToken: integer("has_some_token", { mode: "boolean" }),
		sellAmount: text("sell_amount"),
		quote: text("quote", { mode: "json" }),
		walletSendCalls: text("wallet_send_calls", { mode: "json" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(t) => [
		foreignKey({
			columns: [t.txHash, t.chainId],
			foreignColumns: [userActivity.txHash, userActivity.chainId],
			name: "inline_action_interaction_user_activity_id_fk",
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
	trackedFids: text("tracked_fids", { mode: "json" }).default([]),
	minimumTokenAmountUsdc: integer("minimum_token_amount_usdc", {
		mode: "number",
	}),
	minimumNeynarScore: integer("minimum_neynar_score", { mode: "number" }),
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

export type UserActivity = typeof userActivity.$inferSelect;
export type CreateUserActivity = typeof userActivity.$inferInsert;
export type UpdateUserActivity = Partial<CreateUserActivity>;

export type GroupActivity = typeof groupActivity.$inferSelect;
export type CreateGroupActivity = typeof groupActivity.$inferInsert;
export type UpdateGroupActivity = Partial<CreateGroupActivity>;

export type NeynarWebhook = typeof neynarWebhook.$inferSelect;

export type InlineAction = typeof inlineAction.$inferSelect;
export type CreateInlineAction = typeof inlineAction.$inferInsert;
export type UpdateInlineAction = Partial<CreateInlineAction>;

export type InlineActionInteraction =
	typeof inlineActionInteraction.$inferSelect;
export type CreateInlineActionInteraction =
	typeof inlineActionInteraction.$inferInsert;
export type UpdateInlineActionInteraction =
	Partial<CreateInlineActionInteraction>;

/**
 * Drizzle Relations
 */
export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	walletAddresses: many(walletAddress),
	farcasters: many(farcaster),
	groupMembers: many(groupMember),
	activities: many(userActivity),
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
	activities: many(groupActivity),
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

export const userActivityRelations = relations(userActivity, ({ one }) => ({
	user: one(user, {
		fields: [userActivity.userId],
		references: [user.id],
	}),
	sellToken: one(tokens, {
		fields: [userActivity.sellTokenId],
		references: [tokens.id],
	}),
	buyToken: one(tokens, {
		fields: [userActivity.buyTokenId],
		references: [tokens.id],
	}),
}));

export const groupActivityRelations = relations(groupActivity, ({ one }) => ({
	group: one(group, {
		fields: [groupActivity.groupId],
		references: [group.id],
	}),
	activity: one(userActivity, {
		fields: [groupActivity.activityChainId, groupActivity.activityTxHash],
		references: [userActivity.chainId, userActivity.txHash],
	}),
}));

export const inlineActionRelations = relations(inlineAction, ({ many }) => ({
	interactions: many(inlineActionInteraction),
}));

export const inlineActionInteractionRelations = relations(
	inlineActionInteraction,
	({ one }) => ({
		inlineAction: one(inlineAction, {
			fields: [inlineActionInteraction.inlineActionId],
			references: [inlineAction.id],
		}),
	}),
);
