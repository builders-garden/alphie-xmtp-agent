import type { User as NeynarUser } from "@neynar/nodejs-sdk/build/api/index.js";
import { eq, inArray } from "drizzle-orm";
import type { Address } from "viem";
import { formatAvatarSrc } from "../../../utils/general.js";
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
 * Get user by Farcaster FID
 * @param farcasterFid - The Farcaster FID of the user
 * @returns
 */
export const getUserByFarcasterFid = async (farcasterFid: number) => {
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.farcasterFid, farcasterFid.toString()),
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
 * Internal function to create a user from an address or a already fetched Neynar user
 * @param inboxId - The inboxId of the user
 * @param address - The address of the user
 * @param user - The user
 * @returns
 */
const createUserFromAddress = async (
	inboxId?: string,
	address?: string,
	user?: NeynarUser,
): Promise<User> => {
	let ensName: string | undefined;
	let baseName: string | undefined;
	let ensAvatarUrl: string | null = null;
	let baseAvatarUrl: string | null = null;
	let farcasterFid: string | undefined = user?.fid.toString();
	let farcasterAvatarUrl: string | null = user?.pfp_url
		? formatAvatarSrc(user?.pfp_url)
		: null;
	let farcasterUsername: string | undefined = user?.username;
	let farcasterDisplayName: string | undefined = user?.display_name;

	if (address) {
		ensName = await getEnsName(address as Address);
		baseName = await getBasenameName(address as Address);
		if (ensName) {
			ensAvatarUrl = await getEnsAvatar(ensName);
		}
		if (baseName) {
			baseAvatarUrl = await getBasenameAvatar(baseName);
		}
		if (!user) {
			try {
				const farcasterUser = await fetchUserByAddress(address as Address);
				if (farcasterUser) {
					farcasterFid = farcasterUser.fid.toString();
					farcasterAvatarUrl = farcasterUser.pfp_url
						? formatAvatarSrc(farcasterUser.pfp_url)
						: null;
					farcasterUsername = farcasterUser.username;
					farcasterDisplayName = farcasterUser.display_name;
				}
			} catch (error) {
				console.error("Error fetching Farcaster user:", error);
			}
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
 * Get or create user by inboxId
 */
export const getOrCreateUserByInboxId = async (
	inboxId: string,
	address?: string,
): Promise<User> => {
	const existing = await getUserByInboxId(inboxId);
	if (existing) return existing;
	return createUserFromAddress(inboxId, address);
};

/**
 * Get or create user by Farcaster FID
 * @param user - The Farcaster user
 * @returns
 */
export const getOrCreateUserByFarcasterFid = async (
	user: NeynarUser,
): Promise<User> => {
	const existing = await getUserByFarcasterFid(user.fid);
	if (existing) return existing;

	const address = user.verified_addresses.primary.eth_address ?? undefined;
	return createUserFromAddress(undefined, address, user);
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
