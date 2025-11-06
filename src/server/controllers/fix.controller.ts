import type { Request, Response } from "express";
import { getTokenInfoFromCodex } from "../../lib/codex.js";
import {
	getAllTokensWithoutImage,
	updateTokenImageUrl,
} from "../../lib/db/queries/tokens.query.js";

/**
 * Fix all token controller
 * @param req - The request object
 * @param res - The response object
 * @returns void
 */
export const handleFixTokens = async (_req: Request, res: Response) => {
	try {
		const allTokens = await getAllTokensWithoutImage();

		const updatedTokens = [];
		const failedTokens = [];

		for (const token of allTokens) {
			if (!token.imageUrl) {
				const codexToken = await getTokenInfoFromCodex(
					token.address,
					token.chainId,
				);
				if (codexToken.info?.imageLargeUrl) {
					console.log(
						`[fix-tokens] Updating token ${token.address} image URL to ${codexToken.info.imageLargeUrl}`,
					);
					await updateTokenImageUrl(token.id, codexToken.info.imageLargeUrl);
					updatedTokens.push(token.address);
				} else {
					failedTokens.push(token.address);
				}
			}
		}

		// Return immediately with job information
		res.status(200).json({
			status: "ok",
			message: "Tokens images updated successfully",
			updatedTokens,
			failedTokens,
		});
	} catch (error) {
		console.error("Error fixing tokens images", error);
		res.status(500).json({
			status: "nok",
			error: "Internal server error",
		});
	}
};
