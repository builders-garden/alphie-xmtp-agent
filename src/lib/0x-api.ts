import ky from "ky";
import { type Address, isAddress } from "viem";
import type {
	PriceResponse,
	QuoteResponse,
	ZeroXPriceResponse,
	ZeroXQuoteResponse,
	ZeroXQuoteTransactionResponse,
} from "../types/index.js";
import { env } from "./env.js";

/**
 * Get a quote from the 0x API
 * @param chainId - The chain ID
 * @param buyToken - The token to buy
 * @param sellToken - The token to sell
 * @param sellAmount - The amount to sell
 * @param taker - The taker address
 */
export const get0xQuote = async ({
	chainId,
	buyToken,
	sellToken,
	sellAmount,
	taker,
}: {
	chainId: number;
	buyToken: Address;
	sellToken: Address;
	sellAmount: string;
	taker: Address;
}): Promise<QuoteResponse> => {
	// Validate required parameters
	try {
		if (!chainId || !buyToken || !sellToken || !sellAmount || !taker) {
			return {
				status: "nok",
				error: "Missing required parameters",
			};
		}

		// Validate chainId is a positive integer
		if (Number.isNaN(chainId) || chainId <= 0) {
			return {
				status: "nok",
				error: "chainId must be a positive integer",
			};
		}

		// Build query parameters for 0x API
		const params = new URLSearchParams({
			chainId: chainId.toString(),
			buyToken,
			sellToken,
			sellAmount,
			taker,
		});

		// Optional parameters
		const optionalParams = [
			"txOrigin",
			"swapFeeRecipient",
			"swapFeeBps",
			"swapFeeToken",
			"tradeSurplusRecipient",
			"gasPrice",
			"slippageBps",
			"excludedSources",
			"sellEntireBalance",
		];

		for (const param of optionalParams) {
			const value = params.get(param);
			if (value) {
				// Validate address parameters
				if (
					[
						"txOrigin",
						"swapFeeRecipient",
						"swapFeeToken",
						"tradeSurplusRecipient",
					].includes(param)
				) {
					if (!isAddress(value)) {
						return {
							status: "nok",
							error: "Invalid $paramaddress format",
						};
					}
				}

				// Validate numeric parameters
				if (["swapFeeBps", "slippageBps"].includes(param)) {
					const num = Number.parseInt(value, 10);
					if (Number.isNaN(num) || num < 0 || num > 10000) {
						return {
							status: "nok",
							error: `${param} must be between 0 and 10000`,
						};
					}
				}

				// Validate swapFeeToken format if provided
				if (param === "swapFeeToken") {
					if (!isAddress(value)) {
						return {
							status: "nok",
							error: "Invalid swapFeeToken address format",
						};
					}
				}

				// Validate sellEntireBalance enum
				if (param === "sellEntireBalance") {
					if (!["true", "false"].includes(value)) {
						return {
							status: "nok",
							error: "sellEntireBalance must be 'true' or 'false'",
						};
					}
				}

				params.append(param, value);
			}
		}

		// Make request to 0x API
		const response = await ky.get<ZeroXQuoteResponse>(
			`https://api.0x.org/swap/allowance-holder/quote?${params.toString()}`,
			{
				headers: {
					"0x-api-key": env.ZEROX_API_KEY,
					"0x-version": "v2",
				},
			},
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return {
				status: "nok",
				error: `0x API request failed, error: ${JSON.stringify(errorData)}`,
			};
		}

		const data = await response.json();

		// Extract transaction details from the response
		const { transaction } = data;
		if (!transaction) {
			return {
				status: "nok",
				error: "No transaction data in response",
			};
		}

		// Return only the essential transaction fields
		const response_data: ZeroXQuoteTransactionResponse = {
			to: transaction.to,
			data: transaction.data,
			value: transaction.value,
		};

		return {
			status: "ok",
			data: response_data,
		};
	} catch (error) {
		console.error("0x API Error:", error);
		return {
			status: "nok",
			error: "Internal server error",
		};
	}
};

/**
 * Get a quote from the 0x API
 * @param chainId - The chain ID
 * @param buyToken - The token to buy
 * @param sellToken - The token to sell
 * @param sellAmount - The amount to sell
 * @param taker - The taker address
 */
export const get0xPrice = async ({
	chainId,
	buyToken,
	sellToken,
	sellAmount,
	taker,
}: {
	chainId: number;
	buyToken: Address;
	sellToken: Address;
	sellAmount: string;
	taker: Address;
}): Promise<PriceResponse> => {
	// Validate required parameters
	try {
		if (!chainId || !buyToken || !sellToken || !sellAmount || !taker) {
			return {
				status: "nok",
				error: "Missing required parameters",
			};
		}

		// Validate chainId is a positive integer
		if (Number.isNaN(chainId) || chainId <= 0) {
			return {
				status: "nok",
				error: "chainId must be a positive integer",
			};
		}

		// Build query parameters for 0x API
		const params = new URLSearchParams({
			chainId: chainId.toString(),
			buyToken,
			sellToken,
			sellAmount,
		});

		// Optional parameters
		const optionalParams = [
			"taker",
			"txOrigin",
			"swapFeeRecipient",
			"swapFeeBps",
			"swapFeeToken",
			"tradeSurplusRecipient",
			"gasPrice",
			"slippageBps",
			"excludedSources",
			"sellEntireBalance",
		];

		for (const param of optionalParams) {
			const value = params.get(param);
			if (value) {
				// Validate address parameters
				if (
					[
						"taker",
						"txOrigin",
						"swapFeeRecipient",
						"swapFeeToken",
						"tradeSurplusRecipient",
					].includes(param)
				) {
					if (!isAddress(value)) {
						return {
							status: "nok",
							error: "Invalid $paramaddress format",
						};
					}
				}

				// Validate numeric parameters
				if (["swapFeeBps", "slippageBps"].includes(param)) {
					const num = Number.parseInt(value, 10);
					if (Number.isNaN(num) || num < 0 || num > 10000) {
						return {
							status: "nok",
							error: `${param} must be between 0 and 10000`,
						};
					}
				}

				params.append(param, value);
			}
		}

		// Make request to 0x API
		const response = await ky.get<ZeroXPriceResponse>(
			`https://api.0x.org/swap/allowance-holder/price?${params.toString()}`,
			{
				headers: {
					"0x-api-key": env.ZEROX_API_KEY,
					"0x-version": "v2",
				},
			},
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return {
				status: "nok",
				error: `0x API request failed, status: ${response.status}, error: ${JSON.stringify(errorData)}`,
			};
		}

		const data = await response.json();
		return {
			status: "ok",
			data: data,
		};
	} catch (error) {
		console.error("0x API Error:", error);
		return {
			status: "nok",
			error: "Internal server error",
		};
	}
};
