import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import {
	type Address,
	createPublicClient,
	encodeFunctionData,
	erc20Abi,
	formatUnits,
	type Hex,
	http,
	toHex,
} from "viem";
import { arbitrum, base, mainnet, optimism, zora } from "viem/chains";
import { env } from "../lib/env.js";

/**
 * Get the estimated gas fee for a given chain
 * @param chainId - The chain identifier
 * @returns The estimated gas fee for the given chain
 */
export const getEstimatedGasFee = async ({
	chainId,
}: {
	chainId: number;
}): Promise<{ maxFeePerGas: string; maxPriorityFeePerGas: string }> => {
	const chain = getChain(chainId);
	const publicClient = createPublicClient({
		chain,
		transport: http(),
	});

	const gas = await publicClient.estimateFeesPerGas();
	return {
		maxFeePerGas: gas.maxFeePerGas.toString(),
		maxPriorityFeePerGas: gas.maxPriorityFeePerGas.toString(),
	};
};

/**
 * Swap ERC20 tokens
 * @param fromAddress - The address of the sender
 * @param to - The address of the recipient
 * @param data - The data of the swap
 * @param value - The value of the swap
 * @param gas - The gas for the swap
 * @param chainId - The chain identifier
 * @param sellTokenSymbol - The symbol of the token to sell
 * @param buyTokenSymbol - The symbol of the token to buy
 * @param tokenDecimals - The decimals of the token
 * @param tokenAddress - The address of the ERC20 token
 * @param spender - The address of the spender
 * @param needsApprove - Whether the swap needs approval
 * @param sellAmount - The amount of the token to sell
 * @param sellAmountInDecimals - The amount of the token to sell in base units
 * @returns The calls for the swap
 */
export function swapERC20(data: {
	fromAddress: Address;
	to: Address; // 0x allowance-holder contract to call for the swap
	data: Hex; // calldata for the swap
	value?: string; // eth value to send with the swap (usually 0 for ERC20->ERC20)
	gas: string;
	chainId: number;
	sellTokenSymbol: string;
	buyTokenSymbol: string;
	tokenDecimals: number;
	tokenAddress: Address; // ERC20 token contract to approve
	spender: Address; // 0x allowanceTarget (spender) from quote
	needsApprove: boolean;
	sellAmount: number; // amount in token base units to sell
	sellAmountInDecimals: bigint; // amount in token base units to sell
}): WalletSendCallsParams {
	const calls: WalletSendCallsParams["calls"] = [];

	// if needed, add approve call for the 0x swap api
	if (data.needsApprove) {
		const approvedMethodData = encodeFunctionData({
			abi: erc20Abi,
			functionName: "approve",
			args: [data.spender, data.sellAmountInDecimals],
		});

		calls.push({
			to: data.tokenAddress,
			data: approvedMethodData,
			// approve has no ETH value
			metadata: {
				description: `Approve ${data.sellAmount.toFixed(2)} ${data.sellTokenSymbol}`,
				transactionType: "approve",
				currency: data.sellTokenSymbol,
				amount: data.sellAmount.toFixed(2),
				decimals: data.tokenDecimals.toString(),
				networkId: data.chainId.toString(),
				hostname: new URL(env.APP_URL).hostname,
				faviconUrl:
					"https://www.google.com/s2/favicons?sz=256&domain_url=https%3A%2F%2Fwww.coinbase.com%2Fwallet",
				title: "Alphie XMTP Agent",
			},
		});
	}
	// swap ERC20 call
	calls.push({
		to: data.to,
		data: data.data,
		value: data.value ? toHex(data.value) : undefined,
		gas: toHex(data.gas),
		metadata: {
			description: `Swap ${data.sellAmount.toFixed(2)} ${data.sellTokenSymbol} for ${data.buyTokenSymbol}`,
			transactionType: "swap",
			currency: data.sellTokenSymbol,
			amount: data.sellAmount.toFixed(2),
			decimals: data.tokenDecimals.toString(),
			hostname: new URL(env.APP_URL).hostname,
			networkId: data.chainId.toString(),
			faviconUrl:
				"https://www.google.com/s2/favicons?sz=256&domain_url=https%3A%2F%2Fwww.coinbase.com%2Fwallet",
			title: "Alphie XMTP Agent",
		},
	});

	return {
		version: "1.0",
		from: data.fromAddress,
		chainId: toHex(data.chainId),
		calls,
	};
}

/**
 * Get the chain for a given chain id
 * @param chainId
 * @returns The chain for the given chain id
 */
function getChain(chainId: number) {
	switch (chainId) {
		case base.id:
			return base;
		case mainnet.id:
			return mainnet;
		case zora.id:
			return zora;
		case arbitrum.id:
			return arbitrum;
		case optimism.id:
			return optimism;
		default:
			throw new Error(`Unsupported chain id: ${chainId}`);
	}
}

/**
 * Get ERC20 balance for a given address
 * @param sellTokenAddress - The address of the ERC20 token to sell
 * @param buyTokenAddress - The address of the ERC20 token to buy
 * @param tokenDecimals - The number of decimals of the ERC20 token
 * @param address - The address to get the balance of
 * @returns The balance of the ERC20 token
 */
export async function getTokenInfo({
	sellTokenAddress,
	buyTokenAddress,
	chainId,
}: {
	sellTokenAddress: Address;
	buyTokenAddress: Address;
	chainId: number;
}): Promise<{
	tokenDecimals: number;
	sellSymbol: string;
	buySymbol: string;
}> {
	const chain = getChain(chainId);
	const publicClient = createPublicClient({
		chain,
		transport: http(),
	});
	const wagmiContract = {
		address: sellTokenAddress,
		abi: erc20Abi,
	} as const;
	// Similar to readContract but batches multiple calls https://viem.sh/docs/contract/multicall
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
	if (!tokenDecimals.result || !sellSymbol.result || !buySymbol.result) {
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
 * Get ERC20 balance for a given address
 * @param sellTokenAddress - The address of the ERC20 token to sell
 * @param buyTokenAddress - The address of the ERC20 token to buy
 * @param tokenDecimals - The number of decimals of the ERC20 token
 * @param address - The address to get the balance of
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
	chainId: number;
}): Promise<{
	balanceRaw: string;
	balance: string;
	tokenDecimals: number;
	sellSymbol: string;
	buySymbol: string;
}> {
	const chain = getChain(chainId);
	const publicClient = createPublicClient({
		chain,
		transport: http(),
	});
	const wagmiContract = {
		address: sellTokenAddress,
		abi: erc20Abi,
	} as const;
	// Similar to readContract but batches multiple calls https://viem.sh/docs/contract/multicall
	const [balance, tokenDecimals, sellSymbol, buySymbol] =
		await publicClient.multicall({
			contracts: [
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
				{
					abi: erc20Abi,
					address: buyTokenAddress,
					functionName: "symbol",
				},
			],
		});
	if (
		!balance.result ||
		!tokenDecimals.result ||
		!sellSymbol.result ||
		!buySymbol.result
	) {
		console.error(
			"Unable to get balance, token decimals, sell symbol, or buy symbol",
		);
		throw new Error(
			"Unable to get balance, token decimals, sell symbol, or buy symbol",
		);
	}

	return {
		balanceRaw: balance.result.toString(),
		balance: formatUnits(balance.result, tokenDecimals.result),
		tokenDecimals: tokenDecimals.result,
		sellSymbol: sellSymbol.result,
		buySymbol: buySymbol.result,
	};
}

/**
 * Get the balance of the ETH on a given chain
 * @param address - The address to get the balance of
 * @param chainId - The chain identifier
 * @returns
 */
export async function getEthBalance({
	address,
	chainId,
}: {
	address: Address;
	chainId: number;
}): Promise<{ balanceRaw: string; balance: string }> {
	const chain = getChain(chainId);
	const publicClient = createPublicClient({
		chain,
		transport: http(),
	});
	const balance = await publicClient.getBalance({
		address: address,
	});
	return {
		balanceRaw: balance.toString(),
		balance: formatUnits(balance, 18),
	};
}

/**
 * Create a transfer with approve calls for a given ERC20 token
 * @param fromAddress - The address of the sender
 * @param recipientAddress - The address of the recipient
 * @param amount - The amount to transfer
 * @param amountInDecimals - The amount in decimals
 * @param tokenAddress - The address of the ERC20 token
 * @param tokenDecimals - The number of decimals of the ERC20 token
 * @param chainId - The chain identifier
 * @param networkName - The name of the network
 * @returns The transfer with approve calls for the given ERC20 token
 */
export function createTransferWithApproveCalls({
	fromAddress,
	recipientAddress,
	amount,
	amountInDecimals,
	tokenAddress,
	tokenDecimals,
	chainId,
	networkId,
	networkName,
}: {
	fromAddress: Address;
	recipientAddress: Address;
	amount: number;
	amountInDecimals: bigint;
	tokenAddress: Address;
	tokenDecimals: number;
	chainId: number;
	networkId: string;
	networkName: string;
}): WalletSendCallsParams {
	const approvedMethodData = encodeFunctionData({
		abi: erc20Abi,
		functionName: "approve",
		args: [recipientAddress, amountInDecimals],
	});

	const transferMethodData = encodeFunctionData({
		abi: erc20Abi,
		functionName: "transfer",
		args: [recipientAddress, amountInDecimals],
	});

	return {
		version: "1.0",
		from: fromAddress,
		chainId: toHex(chainId),
		calls: [
			{
				to: tokenAddress,
				data: approvedMethodData,
				// value: toHex(amountInDecimals),
				metadata: {
					description: `Approve ${amount} USDC`,
					transactionType: "approve",
					currency: "USDC",
					amount: amountInDecimals.toString(),
					decimals: tokenDecimals.toString(),
					networkId,
					hostname: new URL(env.APP_URL).hostname,
					faviconUrl:
						"https://www.google.com/s2/favicons?sz=256&domain_url=https%3A%2F%2Fwww.coinbase.com%2Fwallet",
					title: "Alphie XMTP Agent",
				},
			},
			{
				to: tokenAddress,
				data: transferMethodData,
				// value: toHex(amountInDecimals),
				metadata: {
					description: `Transfer ${amount} USDC on ${networkName}`,
					transactionType: "transfer",
					currency: "USDC",
					amount: amountInDecimals.toString(),
					decimals: tokenDecimals.toString(),
					networkId,
					hostname: new URL(env.APP_URL).hostname,
					faviconUrl:
						"https://www.google.com/s2/favicons?sz=256&domain_url=https%3A%2F%2Fwww.coinbase.com%2Fwallet",
					title: "Alphie XMTP Agent",
				},
			},
		],
	};
}
