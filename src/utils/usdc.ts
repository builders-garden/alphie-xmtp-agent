import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import { createPublicClient, formatUnits, http, toHex, erc20Abi } from "viem";
import { base, baseSepolia } from "viem/chains";

// Network configuration type
export type NetworkConfig = {
	tokenAddress: string;
	chainId: number;
	decimals: number;
	networkName: string;
};

// Available network configurations
export const USDC_NETWORKS: NetworkConfig[] = [
	{
		tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
		chainId: baseSepolia.id,
		decimals: 6,
		networkName: "Base Sepolia",
	},
	{
		tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base Mainnet
		chainId: base.id,
		decimals: 6,
		networkName: "Base Mainnet",
	},
];

export class USDCHandler {
	private networkConfig: NetworkConfig;
	private publicClient;

	/**
	 * Create a USDC handler for a specific network
	 * @param chainId - The chain identifier
	 */
	constructor(chainId: number) {
		const config = USDC_NETWORKS.find((network) => network.chainId === chainId);
		if (!config) {
			throw new Error(`Network configuration not found for: ${chainId}`);
		}

		this.networkConfig = config;
		this.publicClient = createPublicClient({
			chain: chainId === base.id ? base : baseSepolia,
			transport: http(),
		});
	}

	/**
	 * Get the network configuration
	 */
	getNetworkConfig(): NetworkConfig {
		return this.networkConfig;
	}

	/**
	 * Get USDC balance for a given address
	 */
	async getUSDCBalance(address: string): Promise<string> {
		const balance = await this.publicClient.readContract({
			address: this.networkConfig.tokenAddress as `0x${string}`,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [address as `0x${string}`],
		});

		return formatUnits(balance, this.networkConfig.decimals);
	}

	/**
	 * Create wallet send calls parameters for USDC transfer
	 */
	createUSDCTransferCalls(
		fromAddress: string,
		recipientAddress: string,
		amount: number,
	): WalletSendCallsParams {
		const methodSignature = "0xa9059cbb"; // Function signature for ERC20 'transfer(address,uint256)'

		// Format the transaction data following ERC20 transfer standard
		const transactionData = `${methodSignature}${recipientAddress
			.slice(2)
			.padStart(64, "0")}${BigInt(amount).toString(16).padStart(64, "0")}`;

		return {
			version: "1.0",
			from: fromAddress as `0x${string}`,
			chainId: toHex(this.networkConfig.chainId),
			calls: [
				{
					to: this.networkConfig.tokenAddress as `0x${string}`,
					data: transactionData as `0x${string}`,
					metadata: {
						description: `Transfer ${
							amount / Math.pow(10, this.networkConfig.decimals)
						} USDC on ${this.networkConfig.networkName}`,
						transactionType: "transfer",
						currency: "USDC",
						amount: amount.toString(),
						decimals: this.networkConfig.decimals.toString(),
					},
				},
				/* add more calls here */
			],
		};
	}
}
