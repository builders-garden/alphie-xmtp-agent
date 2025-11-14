import { createPublicClient, http } from "viem";
import * as chains from "viem/chains";
import { env } from "../lib/env.js";

export const basePublicClient = createPublicClient({
	chain: chains.base,
	transport: http(
		`https://api.developer.coinbase.com/rpc/v1/base/${env.COINBASE_CDP_CLIENT_API_KEY}`
	),
});

/**
 * Gets the chain object for the given chain id.
 * @param chainId - Chain id of the target EVM chain.
 * @returns Viem's chain object.
 */
export const getChainByName = (chainName: string) => {
	for (const chain of Object.values(chains)) {
		if ("id" in chain && chain.name.toLowerCase() === chainName.toLowerCase()) {
			return chain;
		}
	}

	throw new Error(`Chain with name ${chainName} not found`);
};

/**
 * Get the chain for a given chain id
 * @param chainId
 * @returns The chain for the given chain id
 */
export function getChain(chainId: number) {
	switch (chainId) {
		case chains.mainnet.id:
			return chains.mainnet;
		case chains.base.id:
			return chains.base;
		case chains.arbitrum.id:
			return chains.arbitrum;
		case chains.optimism.id:
			return chains.optimism;
		case chains.polygon.id:
			return chains.polygon;
		default:
			throw new Error(`Unsupported chain id: ${chainId}`);
	}
}
