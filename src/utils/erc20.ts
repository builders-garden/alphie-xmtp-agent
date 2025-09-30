import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import {
	type Address,
	createPublicClient,
	encodeFunctionData,
	erc20Abi,
	formatUnits,
	http,
	toHex,
} from "viem";
import { base, mainnet } from "viem/chains";
import { env } from "../lib/env.js";

export class ERC20Handler {
	/**
	 * Get the chain for a given chain id
	 * @param chainId
	 * @returns The chain for the given chain id
	 */
	getChain(chainId: number) {
		switch (chainId) {
			case base.id:
				return base;
			case mainnet.id:
				return mainnet;
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
	async getBalance({
		tokenAddress,
		tokenDecimals,
		address,
		chainId,
	}: {
		tokenAddress: Address;
		tokenDecimals: number;
		address: Address;
		chainId: number;
	}): Promise<string> {
		const chain = this.getChain(chainId);
		const publicClient = createPublicClient({
			chain,
			transport: http(),
		});
		const balance = await publicClient.readContract({
			address: tokenAddress,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [address],
		});

		return formatUnits(balance, tokenDecimals);
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
	createTransferWithApproveCalls({
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
}
