import { and, eq, isNull } from "drizzle-orm";
import { type CreateTokens, tokens } from "../db.schema.js";
import { db } from "../index.js";

/**
 *
 * @param chainId - The chain ID
 * @returns The token info
 */
export const getTokenInfoFromDb = async ({
	tokenAddress,
	chainId,
}: {
	tokenAddress: string;
	chainId: number;
}) => {
	const token = await db.query.tokens.findFirst({
		where: and(eq(tokens.address, tokenAddress), eq(tokens.chainId, chainId)),
	});
	return token;
};

/**
 * Create a token
 * @param data - The data to create the token
 * @returns The created token
 */
export const saveTokenInDb = async (data: CreateTokens) => {
	const [token] = await db.insert(tokens).values(data).returning();
	return token;
};

/**
 *
 * @returns All tokens
 */
export const getAllTokens = async () => await db.query.tokens.findMany();
/**
 *
 * @returns All tokens
 */
export const getAllTokensWithoutImage = async () =>
	await db.query.tokens.findMany({
		where: isNull(tokens.imageUrl),
	});

/**
 * Update the image URL of a token
 * @param tokenId - The ID of the token
 * @param imageUrl - The new image URL
 * @returns The updated token
 */
export const updateTokenImageUrl = async (
	tokenId: string,
	imageUrl: string
) => {
	const [token] = await db
		.update(tokens)
		.set({ imageUrl })
		.where(eq(tokens.id, tokenId))
		.returning();
	return token;
};
