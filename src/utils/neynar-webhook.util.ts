import { env } from "../lib/env.js";

/**
 * Send the same sample payload as tests/test-webhook.sh to the backend webhook endpoint.
 */
export const sendTestNeynarTradeCreatedWebhook = async (groupId: string) => {
	const url = `${env.BACKEND_URL}/api/v1/neynar/webhooks/test`;

	const payload = {
		groupId,
		type: "trade.created",
		data: {
			object: "trade",
			trader: { object: "user_dehydrated", fid: 4461, score: 0.9 },
			pool: {
				object: "pool",
				address: "0x0000000000000000000000000000000000000000",
			},
			transaction: {
				hash: "0x3d4d44b40b5bbbd659c64ce16277f5a0ef2390afc9126b4932de7bb320769649",
				network: { object: "network", name: "base" },
				net_transfer: {
					object: "net_transfer",
					receiving_fungible: {
						object: "fungible_balance",
						token: {
							object: "token",
							address: "0x1111111111166b7FE7bd91427724B487980aFc69",
							decimals: 18,
							symbol: "ZORA",
							name: "Zora",
							total_supply: "10000000000000000000000000000",
						},
						balance: { in_usd: 1, in_token: "16.52018" },
					},
					sending_fungible: {
						object: "fungible_balance",
						token: {
							object: "token",
							address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
							decimals: 6,
							symbol: "USDC",
							name: "USD Coin",
							total_supply: "4402907228870842",
						},
						balance: { in_usd: 1, in_token: "1" },
					},
				},
			},
		},
	};

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		console.error(
			`Webhook call failed: ${response.status} ${response.statusText} ${text}`,
		);
		return {
			success: false,
			error: text,
		};
	}
	const data = await response.json();
	console.log("Webhook call successful", JSON.stringify(data, null, 2));
	return {
		success: true,
		data,
	};
};
