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
 * @param chainId - The chain identifier
 * @returns The calls for the swap
 */
export function swapERC20({
	fromAddress,
	to,
	data,
	value,
	chainId,
}: {
	fromAddress: Address;
	to: Address;
	data: Hex;
	value: string;
	chainId: number;
}): WalletSendCallsParams {
	console.log(
		"swapERC20 params",
		JSON.stringify({
			chainId,
			fromAddress,
			to,
			value,
			data,
		}),
	);

	const calls = {
		version: "1.0",
		from: fromAddress,
		chainId: toHex(chainId),
		calls: [
			{
				to,
				data,
				value: toHex(value),
				metadata: {
					description: `Swap ${value}`,
					transactionType: "swap",
					currency: "USDC",
					amount: value,
					hostname: new URL(env.APP_URL).hostname,
					networkId: chainId.toString(),
					faviconUrl:
						"https://www.google.com/s2/favicons?sz=256&domain_url=https%3A%2F%2Fwww.coinbase.com%2Fwallet",
					title: "Alphie XMTP Agent",
				},
			},
		],
	};

	return calls;
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
 * @param tokenAddress - The address of the ERC20 token
 * @param tokenDecimals - The number of decimals of the ERC20 token
 * @param address - The address to get the balance of
 * @returns The balance of the ERC20 token
 */
export async function getBalance({
	tokenAddress,
	address,
	chainId,
}: {
	tokenAddress: Address;
	address: Address;
	chainId: number;
}): Promise<{ balanceRaw: string; balance: string; tokenDecimals: number }> {
	const chain = getChain(chainId);
	const publicClient = createPublicClient({
		chain,
		transport: http(),
	});
	const [balance, tokenDecimals] = await Promise.all([
		publicClient.readContract({
			address: tokenAddress,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [address],
		}),
		await publicClient.readContract({
			address: tokenAddress,
			abi: erc20Abi,
			functionName: "decimals",
		}),
	]);

	return {
		balanceRaw: balance.toString(),
		balance: formatUnits(balance, tokenDecimals),
		tokenDecimals,
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
