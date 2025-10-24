import { and, eq } from "drizzle-orm";
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
