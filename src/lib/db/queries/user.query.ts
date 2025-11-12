import type { User as NeynarUser } from "@neynar/nodejs-sdk/build/api/index.js";
import { and, eq, inArray } from "drizzle-orm";
import { ulid } from "ulid";
import type { Address } from "viem";
import { formatAvatarSrc } from "../../../utils/index.js";
import { fetchUserFromNeynarByAddress } from "../../neynar.js";
import {
	account,
	type CreateUser,
	type Farcaster,
	farcaster,
	type User,
	user,
} from "../db.schema.js";
import { db } from "../index.js";

/**
 * Get user by XMTP inboxId
 */
export const getUserByInboxId = async (
	inboxId: string
): Promise<(User & { farcaster?: Farcaster }) | null> => {
	const row = await db.query.farcaster.findFirst({
		where: eq(farcaster.inboxId, inboxId),
		with: { user: true },
	});
	if (!row) {
		return null;
	}
	return { ...row.user, farcaster: row };
};

/**
 * Get user by Farcaster FID
 * @param farcasterFid - The Farcaster FID of the user
 * @returns
 */
export const getUserByFarcasterFid = async (farcasterFid: number) => {
	const row = await db.query.farcaster.findFirst({
		where: eq(farcaster.fid, farcasterFid),
		with: { user: true },
	});
	return row?.user ?? null;
};

/**
 * Create user
 */
export const createUser = async (input: CreateUser) => {
	const [newUser] = await db.insert(user).values(input).returning();
	return newUser;
};

/**
 * Internal function to create a user from an address or a already fetched Neynar user
 * @param inboxId - The inboxId of the user
 * @param address - The address of the user
 * @param neynarUser - The user
 * @returns
 * @throws Error if unable to resolve Farcaster FID for user creation. Address or Neynar user with fid is required.
 */
const createUserFromAddress = async (
	inboxId?: string,
	address?: string,
	neynarUser?: NeynarUser
): Promise<User & { farcaster?: Farcaster }> => {
	let farcasterFid: number | undefined = neynarUser?.fid;
	let farcasterAvatarUrl: string | null = neynarUser?.pfp_url
		? formatAvatarSrc(neynarUser?.pfp_url)
		: null;
	let farcasterUsername: string | undefined = neynarUser?.username;
	let farcasterDisplayName: string | undefined = neynarUser?.display_name;

	if (address) {
		if (!neynarUser) {
			try {
				const farcasterUser = await fetchUserFromNeynarByAddress(
					address as Address
				);
				if (farcasterUser) {
					farcasterFid = farcasterUser.fid;
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

	if (!farcasterFid) {
		throw new Error(
			"Unable to resolve Farcaster FID for user creation. Address or Neynar user with fid is required."
		);
	}

	// If farcaster user already exists, link and update missing fields
	const existingFc = await db.query.farcaster.findFirst({
		where: eq(farcaster.fid, farcasterFid),
		with: { user: true },
	});
	if (existingFc?.user) {
		// Ensure inboxId is set if provided
		if (inboxId && !existingFc.inboxId) {
			await db
				.update(farcaster)
				.set({ inboxId })
				.where(
					and(
						eq(farcaster.fid, farcasterFid),
						eq(farcaster.userId, existingFc.user.id)
					)
				);
		}

		return { ...existingFc.user, farcaster: existingFc };
	}

	// Create everything in a transaction
	return await db.transaction(async (tx) => {
		const newUserId = ulid();
		const placeholderName =
			farcasterDisplayName || farcasterUsername || `user-${farcasterFid}`;
		const placeholderEmail = `${farcasterFid}@farcaster.emails`;
		const [createdUser] = await tx
			.insert(user)
			.values({
				id: newUserId,
				name: placeholderName,
				email: placeholderEmail,
				image: farcasterAvatarUrl ?? undefined,
			})
			.returning();

		const ensuredFarcasterFid: number = farcasterFid;
		if (!address) {
			throw new Error(
				"Cannot create farcaster profile without custody address"
			);
		}

		const [createdFarcaster] = await tx
			.insert(farcaster)
			.values({
				id: ulid(),
				userId: createdUser.id,
				inboxId,
				fid: ensuredFarcasterFid,
				username: farcasterUsername ?? placeholderName,
				displayName: farcasterDisplayName ?? placeholderName,
				avatarUrl: farcasterAvatarUrl ?? undefined,
			})
			.returning();

		const [createdAccount] = await tx
			.insert(account)
			.values({
				id: ulid(),
				userId: createdUser.id,
				providerId: "farcaster",
				accountId: `farcaster:${farcasterFid}`,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		return {
			...createdUser,
			farcaster: createdFarcaster ?? undefined,
			account: createdAccount ?? undefined,
		};
	});
};

/**
 * Get or create user by inboxId
 */
export const getOrCreateUserByInboxId = async (
	inboxId: string,
	address?: string
): Promise<(User & { farcaster?: Farcaster }) | null> => {
	try {
		const existing = await getUserByInboxId(inboxId);
		if (existing) {
			return existing;
		}
		const newUser = await createUserFromAddress(inboxId, address);
		return newUser;
	} catch (err) {
		console.error("an error occured creating the user", err);
		return null;
	}
};

/**
 * Get or create user by Farcaster FID
 * @param user - The Farcaster user
 * @returns
 */
export const getOrCreateUserByFarcasterFid = async (
	neynarUser: NeynarUser
): Promise<(User & { farcaster?: Farcaster }) | null> => {
	try {
		const existing = await getUserByFarcasterFid(neynarUser.fid);
		if (existing) return existing;

		const address =
			neynarUser.verified_addresses.primary.eth_address ?? undefined;
		if (!address) {
			throw new Error("Cannot create user without a custody address");
		}
		return await createUserFromAddress(undefined, address, neynarUser);
	} catch (err) {
		console.error("an error occured creating the user", err);
		return null;
	}
};

/**
 * Get users by a list of inboxIds
 */
export const getUsersByInboxIds = async (
	inboxIds: string[]
): Promise<(User & { farcaster?: Farcaster })[]> => {
	if (inboxIds.length === 0) return [];
	const rows = await db.query.farcaster.findMany({
		where: inArray(farcaster.inboxId, inboxIds),
		with: { user: true },
	});
	return rows.map((r) => ({ ...r.user, farcaster: r }));
};

/**
 * Get or create users by inboxIds
 * @param data - The data to get or create users by inboxIds
 * @returns
 */
export const getOrCreateUsersByInboxIds = async (
	data: { inboxId: string; address?: string }[]
) => {
	const inboxIds = data.map((d) => d.inboxId);
	const existing = await getUsersByInboxIds(inboxIds);
	const existingInboxIds = new Set(
		existing
			.map((r) => r.farcaster?.inboxId)
			.filter((v): v is string => Boolean(v))
	);
	const toCreate = data.filter((d) => !existingInboxIds.has(d.inboxId));
	const created = await Promise.all(
		toCreate.map(async (d) => {
			try {
				return await createUserFromAddress(d.inboxId, d.address);
			} catch (err) {
				console.error("an error occured creating the user", err);
				return null;
			}
		})
	);
	return [...existing, ...created.filter((u) => u !== null)];
};
