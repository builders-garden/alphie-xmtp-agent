import {
	type Address,
	createPublicClient,
	erc20Abi,
	formatUnits,
	type Hex,
	http,
	zeroAddress,
} from "viem";
import { base } from "viem/chains";
import { basePublicClient, getChain } from "./viem.util.js";

/**
 * Get info about the tokens and the user balance on a given chain in eth and in the token
 * @param sellTokenAddress - The address of the ERC20 token to sell
 * @param buyTokenAddress - The address of the ERC20 token to buy
 * @param chainId - The chain identifier
 * @returns The balance of the ERC20 token
 */
export async function getTokenInfo({
	sellTokenAddress,
	buyTokenAddress,
	chainId,
}: {
	sellTokenAddress: Address;
	buyTokenAddress: Address;
	chainId?: number;
}): Promise<{
	tokenDecimals: number;
	sellSymbol: string;
	buySymbol: string;
}> {
	/** biome-ignore lint/suspicious/noExplicitAny: cannot cast to publicClient type */
	let publicClient: any;
	if (chainId) {
		publicClient = createPublicClient({
			chain: getChain(chainId),
			transport: http(),
		});
	} else {
		publicClient = basePublicClient;
	}
	const wagmiContract = {
		address: sellTokenAddress,
		abi: erc20Abi,
	} as const;

	const [tokenDecimals, sellSymbol, buySymbol] = await publicClient.multicall({
		contracts: [
			{
				...wagmiContract,
				functionName: "decimals",
			},
			{
				...wagmiContract,
				functionName: "symbol",
			},
			{
				abi: erc20Abi,
				address: buyTokenAddress,
				functionName: "symbol",
			},
		],
	});
	if (!(tokenDecimals.result && sellSymbol.result && buySymbol.result)) {
		console.error("Unable to get token decimals, sell symbol, or buy symbol");
		throw new Error("Unable to get token decimals, sell symbol, or buy symbol");
	}

	return {
		tokenDecimals: tokenDecimals.result,
		sellSymbol: sellSymbol.result,
		buySymbol: buySymbol.result,
	};
}

/**
 * Get the balance of the ETH on a given chain
 * @param address - The address to get the balance of
 * @param publicClient - The public client to use
 * @returns
 */
export async function getEthBalance({
	address,
	chainId,
}: {
	address: Address;
	chainId?: number;
}): Promise<{ balanceRaw: string; balance: string }> {
	/** biome-ignore lint/suspicious/noExplicitAny: cannot cast to publicClient type */
	let publicClient: any;
	if (chainId) {
		publicClient = createPublicClient({
			chain: getChain(chainId),
			transport: http(),
		});
	} else {
		publicClient = basePublicClient;
	}
	const balance = await publicClient.getBalance({
		address,
	});

	return {
		balanceRaw: balance.toString(),
		balance: formatUnits(balance, 18),
	};
}

/**
 * Get ERC20 balance for a given address
 * @param sellTokenAddress - The address of the ERC20 token to sell
 * @param buyTokenAddress - The address of the ERC20 token to buy
 * @param tokenDecimals - The number of decimals of the ERC20 token
 * @param address - The address to get the balance of
 * @param publicClient - The public client to use
 * @returns The balance of the ERC20 token
 */
export async function getTokenBalance({
	sellTokenAddress,
	buyTokenAddress,
	address,
	chainId,
}: {
	sellTokenAddress: Address;
	buyTokenAddress: Address;
	address: Address;
	chainId?: number;
}): Promise<{
	balanceRaw: string;
	balance: string;
	tokenDecimals: number;
	sellSymbol: string;
	buySymbol: string;
}> {
	// handle sellToken is ETH
	if (sellTokenAddress === zeroAddress) {
		const ethBalance = await getEthBalance({
			address,
			chainId,
		});

		// handle also buyToken is ETH
		if (buyTokenAddress === zeroAddress) {
			return {
				balanceRaw: ethBalance.balanceRaw,
				balance: ethBalance.balance,
				tokenDecimals: 18,
				sellSymbol: "ETH",
				buySymbol: "ETH",
			};
		}

		/** biome-ignore lint/suspicious/noExplicitAny: cannot cast to publicClient type */
		let publicClient: any;
		if (chainId) {
			publicClient = createPublicClient({
				chain: getChain(chainId),
				transport: http(),
			});
		} else {
			publicClient = basePublicClient;
		}
		const buySymbol = await publicClient.readContract({
			address: buyTokenAddress,
			abi: erc20Abi,
			functionName: "symbol",
		});
		return {
			balanceRaw: ethBalance.balanceRaw,
			balance: ethBalance.balance,
			tokenDecimals: 18,
			sellSymbol: "ETH",
			buySymbol: buySymbol.normalize(),
		};
	}

	const wagmiContract = {
		address: sellTokenAddress,
		abi: erc20Abi,
	} as const;

	/** biome-ignore lint/suspicious/noExplicitAny: cannot cast to publicClient type */
	let publicClient: any;
	if (chainId) {
		publicClient = createPublicClient({
			chain: getChain(chainId),
			transport: http(),
		});
	} else {
		publicClient = basePublicClient;
	}

	const calls = [
		{
			...wagmiContract,
			functionName: "balanceOf",
			args: [address],
		},
		{
			...wagmiContract,
			functionName: "decimals",
		},
		{
			...wagmiContract,
			functionName: "symbol",
		},
	];

	// if buyToken is not ETH, get the token symbol from the erc20
	if (buyTokenAddress !== zeroAddress) {
		calls.push({
			abi: erc20Abi,
			address: buyTokenAddress,
			functionName: "symbol",
		});
	}

	// get the results from the multicall
	const results = await publicClient.multicall({
		contracts: calls,
	});

	const [balance, tokenDecimals, sellSymbol] = results;
	let buySymbol: string | undefined;

	// if buyToken is not ETH, get the token symbol from the erc20
	if (buyTokenAddress !== zeroAddress && results.length > 3) {
		const [, , , tmpBuySymbol] = results;
		if (!tmpBuySymbol.result) {
			console.error("Unable to get buy symbol", {
				buySymbol,
			});
			throw new Error("Unable to get buy symbol");
		}
		buySymbol = tmpBuySymbol.result.toString();
	}

	if (
		balance.result === undefined ||
		!tokenDecimals.result ||
		!sellSymbol.result
	) {
		console.error("Unable to get balance, token decimals, sell symbol", {
			balance,
			tokenDecimals,
			sellSymbol,
		});
		throw new Error("Unable to get balance, token decimals, sell symbol");
	}

	return {
		balanceRaw: balance.result.toString(),
		balance: formatUnits(
			balance.result as bigint,
			tokenDecimals.result as number
		),
		tokenDecimals: tokenDecimals.result as number,
		sellSymbol: sellSymbol.result as string,
		buySymbol: buySymbol
			? buySymbol.normalize()
			: buyTokenAddress === zeroAddress
				? "ETH"
				: "Unknown",
	};
}

/**
 * Get the estimated gas fee for a given chain
 * @param publicClient - The public client to use
 * @returns The estimated gas fee for the given chain
 */
export const getEstimatedGasFee = async ({
	chainId,
}: {
	chainId?: number;
}): Promise<{ maxFeePerGas: string; maxPriorityFeePerGas: string }> => {
	/** biome-ignore lint/suspicious/noExplicitAny: cannot cast to publicClient type */
	let publicClient: any;
	if (chainId) {
		publicClient = createPublicClient({
			chain: getChain(chainId),
			transport: http(),
		});
	} else {
		publicClient = basePublicClient;
	}
	const gas = await publicClient.estimateFeesPerGas();
	return {
		maxFeePerGas: gas.maxFeePerGas.toString(),
		maxPriorityFeePerGas: gas.maxPriorityFeePerGas.toString(),
	};
};

/**
 * Get info about the tokens and the user balance on a given chain in eth and in the token
 * @param sellTokenAddress - The address of the ERC20 token to sell
 * @param buyTokenAddress - The address of the ERC20 token to buy
 * @param senderAddress - The address of the sender
 * @param chainId - The chain identifier
 * @returns
 */
export const getTransactionData = async ({
	sellTokenAddress,
	buyTokenAddress,
	senderAddress,
	chainId,
}: {
	sellTokenAddress: Address;
	buyTokenAddress: Address;
	senderAddress: Address;
	chainId: number;
}): Promise<{
	tokenBalance: {
		balanceRaw: string;
		balance: string;
		tokenDecimals: number;
		sellSymbol: string;
		buySymbol: string;
	};
	ethBalance: { balanceRaw: string; balance: string };
	gasEstimate: { maxFeePerGas: string; maxPriorityFeePerGas: string };
}> => {
	const [tokenBalance, ethBalance, gasEstimate] = await Promise.all([
		getTokenBalance({
			sellTokenAddress,
			buyTokenAddress,
			address: senderAddress,
			chainId: chainId === base.id ? undefined : chainId,
		}),
		getEthBalance({
			address: senderAddress,
			chainId: chainId === base.id ? undefined : chainId,
		}),
		getEstimatedGasFee({ chainId: chainId === base.id ? undefined : chainId }),
	]);
	return {
		tokenBalance,
		ethBalance,
		gasEstimate,
	};
};

/**
 * Get the block timestamp for a given transaction hash and chain id
 * @param txHash
 * @param chainId
 * @returns
 */
export const getTransactionTimestamp = async ({
	txHash,
	chainId,
}: {
	txHash: Hex;
	chainId: number;
}) => {
	if (chainId === base.id) {
		const receipt = await basePublicClient.getTransactionReceipt({
			hash: txHash,
		});
		if (!receipt) {
			return null;
		}
		const blockHash = receipt.blockHash;
		const block = await basePublicClient.getBlock({
			blockHash,
		});
		if (!block) {
			return null;
		}
		return block.timestamp;
	}
	// chain is not base, create a public client for the given chain
	const publicClient = createPublicClient({
		chain: getChain(chainId),
		transport: http(),
	});
	const receipt = await publicClient.getTransactionReceipt({
		hash: txHash,
	});
	if (!receipt) {
		return null;
	}
	const blockHash = receipt.blockHash;
	const block = await publicClient.getBlock({
		blockHash,
	});
	if (!block) {
		return null;
	}
	return block.timestamp;
};
