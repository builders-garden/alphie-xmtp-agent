import { Codex } from "@codex-data/sdk";
import { env } from "./env.js";

export const codexClient = new Codex(env.CODEX_API_KEY);

/**
 *
 * @param address - The address of the token
 * @param networkId - The network ID
 * @returns The token info
 */
export const getTokenInfoFromCodex = async (
	address: string,
	networkId: number
) => {
	const token = await codexClient.queries.token({
		input: {
			address,
			networkId,
		},
	});
	return token.token;
};
