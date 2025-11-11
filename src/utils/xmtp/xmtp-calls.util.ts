import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import {
	type Address,
	encodeFunctionData,
	erc20Abi,
	type Hex,
	toHex,
} from "viem";
import { base } from "viem/chains";
import { XMTP_NETWORKS } from "../../lib/constants.js";
import { env } from "../../lib/env.js";

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
}) {
	// handle metadata
	const network = XMTP_NETWORKS[data.chainId];
	const metadataInfo = {
		currency: data.sellTokenSymbol,
		amount: data.sellAmount.toFixed(4),
		decimals: data.tokenDecimals.toString(),
		networkId: network.networkId,
		hostname: new URL(env.APP_URL).hostname,
		faviconUrl:
			"https://www.google.com/s2/favicons?sz=256&domain_url=https%3A%2F%2Fwww.coinbase.com%2Fwallet",
		title: "Alphie XMTP Agent",
	};

	const coinbasePaymasterUrl = `https://api.developer.coinbase.com/rpc/v1/base/${env.COINBASE_CDP_CLIENT_API_KEY}`;
	const pimlicoPaymasterUrl = `https://api.pimlico.io/v2/${data.chainId}/rpc?apikey=${env.PIMLICO_API_KEY}`;
	// if using base, use coinbase paymaster, otherwise use pimlico paymaster
	const paymasterUrl =
		data.chainId === base.id ? coinbasePaymasterUrl : pimlicoPaymasterUrl;

	// handle calls
	const calls: WalletSendCallsParams["calls"] = [];
	// adjust gas returned by 0x with a 10% extra
	const adjGas = Math.ceil(Number(data.gas) * 1.1).toString();
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
			gas: toHex("50000"), //static 50k gas for the approve call
			metadata: {
				description: `Approve ${data.sellAmount.toFixed(4)} ${data.sellTokenSymbol}`,
				transactionType: "approve",
				...metadataInfo,
			},
		});
	}
	// swap ERC20 call
	calls.push({
		to: data.to,
		data: data.data,
		value: data.value ? toHex(data.value) : undefined,
		gas: toHex(adjGas), //dynamic incremented gas from 0x api result
		metadata: {
			description: `Swap ${data.sellAmount.toFixed(4)} ${data.sellTokenSymbol} for ${data.buyTokenSymbol} on ${network.networkName}`,
			transactionType: "swap",
			...metadataInfo,
		},
	});

	return {
		version: "1.0",
		from: data.fromAddress,
		chainId: toHex(data.chainId),
		capabilities: {
			paymasterService: {
				url: paymasterUrl,
			},
		},
		calls,
	};
}
