import * as chains from "viem/chains";

/**
 * Gets the chain object for the given chain id.
 * @param chainId - Chain id of the target EVM chain.
 * @returns Viem's chain object.
 */
export const getChainByName = (chainName: string) => {
	for (const chain of Object.values(chains)) {
		if ("id" in chain) {
			if (chain.name.toLowerCase() === chainName.toLowerCase()) {
				return chain;
			}
		}
	}

	throw new Error(`Chain with name ${chainName} not found`);
};
