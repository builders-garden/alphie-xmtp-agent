import type { CoingeckoCoinResponse } from "../types/index.js";
import { env } from "./env.js";

/**
 * Get the info about a token from Coingecko
 * @param chainName - The name of the chain
 * @param tokenAddress - The address of the token
 * @returns
 */
export const getCoingeckoTokenInfo = async (
	chainName: string,
	tokenAddress: string,
): Promise<CoingeckoCoinResponse | null> => {
	try {
		const response = await fetch(
			`https://api.coingecko.com/api/v3/coins/${chainName}/contract/${tokenAddress}`,
			{
				method: "GET",
				headers: {
					"x-cg-demo-api-key": env.COINGECKO_API_KEY,
				},
			},
		);

		if (!response.ok) {
			console.error(
				`Failed to get Coingecko token info: ${response.statusText}`,
				{
					chainName,
					tokenAddress,
				},
			);
			return null;
		}

		const data = (await response.json()) as CoingeckoCoinResponse;
		return data;
	} catch (error) {
		console.error("Failed to get Coingecko token info", error);
		return null;
	}
};
