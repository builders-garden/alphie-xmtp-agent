import { eq, inArray } from "drizzle-orm";
import type { Address } from "viem";
import {
	getBasenameAvatar,
	getBasenameName,
	getEnsAvatar,
	getEnsName,
} from "../../ens.js";
import { fetchUserByAddress } from "../../neynar.js";
import { type CreateUser, type User, userTable } from "../db.schema.js";
import { db } from "../index.js";

/**
 * Get user by address
 */
export const getUserByAddress = async (address: string) => {
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.address, address),
	});
	return user;
};

/**
 * Get user by XMTP inboxId
 */
export const getUserByInboxId = async (inboxId: string) => {
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.inboxId, inboxId),
	});
	return user;
};

/**
 * Create user
 */
export const createUser = async (input: CreateUser) => {
	const [newUser] = await db.insert(userTable).values(input).returning();
	return newUser;
};

/**
 * Get or create user by inboxId
 */
export const getOrCreateUserByInboxId = async (
	inboxId: string,
	address?: string,
): Promise<User> => {
	const existing = await getUserByInboxId(inboxId);
	if (existing) return existing;

	let ensName: string | undefined;
	let baseName: string | undefined;
	let ensAvatarUrl: string | null = null;
	let baseAvatarUrl: string | null = null;
	let farcasterFid: string | undefined;
	let farcasterAvatarUrl: string | null = null;
	let farcasterUsername: string | undefined;
	let farcasterDisplayName: string | undefined;

	if (address) {
		ensName = await getEnsName(address as Address);
		baseName = await getBasenameName(address as Address);
		if (ensName) {
			ensAvatarUrl = await getEnsAvatar(ensName);
		}
		if (baseName) {
			baseAvatarUrl = await getBasenameAvatar(baseName);
		}
		try {
			const farcasterUser = await fetchUserByAddress(address as Address);
			if (farcasterUser) {
				farcasterFid = farcasterUser.fid.toString();
				farcasterAvatarUrl = farcasterUser.pfp_url;
				farcasterUsername = farcasterUser.username;
				farcasterDisplayName = farcasterUser.display_name;
			}
		} catch (error) {
			console.error("Error fetching Farcaster user:", error);
		}
	}
	const created = await createUser({
		inboxId,
		address,
		ensName,
		baseName,
		ensAvatarUrl,
		baseAvatarUrl,
		farcasterFid,
		farcasterAvatarUrl,
		farcasterUsername,
		farcasterDisplayName,
	});
	return created;
};

/**
 * Get users by a list of inboxIds
 */
export const getUsersByInboxIds = async (inboxIds: string[]) => {
	if (inboxIds.length === 0) return [];
	const users = await db
		.select()
		.from(userTable)
		.where(inArray(userTable.inboxId, inboxIds));
	return users;
};
