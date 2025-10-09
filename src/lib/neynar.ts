import { createHmac } from "node:crypto";
import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk";
import type { User as NeynarUser } from "@neynar/nodejs-sdk/build/api/index.js";
import ky from "ky";
import type { NeynarWebhookResponse } from "../types/neynar.type.js";
import { formatAvatarSrc } from "../utils/index.js";
import { env } from "./env.js";

const config = new Configuration({
	apiKey: env.NEYNAR_API_KEY,
});

const neynarClient = new NeynarAPIClient(config);

/**
 * Fetch multiple users from Neynar
 * @param fids - comma separated FIDs of the users to fetch
 * @returns The users
 */
export const fetchBulkUsersFromNeynar = async (
	fids: number[],
	viewerFid?: number,
): Promise<NeynarUser[]> => {
	if (!fids) return [];

	const data = await neynarClient.fetchBulkUsers({
		fids,
		viewerFid,
	});

	return data.users || [];
};

/**
 * Fetch a single user from Neynar
 * @param fid - The FID of the user to fetch
 * @returns The user
 */
export const fetchUserFromNeynarByFid = async (
	fid: number,
): Promise<NeynarUser | null> => {
	if (!fid) return null;
	const users = await fetchBulkUsersFromNeynar([fid]);
	if (!users || users.length === 0) return null;
	return users[0];
};

/**
 * Search for users by username
 * @param username - The username to search for
 * @param viewerFid - The FID of the viewer
 * @returns The users
 */
export const searchUserByUsername = async (
	username: string,
	viewerFid?: number,
): Promise<NeynarUser | null> => {
	const data = await neynarClient.searchUser({
		q: username,
		limit: 1,
		viewerFid,
	});

	if (!data.result?.users) {
		return null;
	}
	const users = data.result.users.map((user) => ({
		...user,
		pfp_url: user.pfp_url ? formatAvatarSrc(user.pfp_url) : "",
	}));
	return users[0];
};

/**
 * Fetch a neynar user by address
 * @param address - The address to fetch the user by
 * @returns The user
 */
export const fetchUserByAddress = async (
	address: string,
	viewerFid?: number,
): Promise<NeynarUser | undefined> => {
	const data = await neynarClient.fetchBulkUsersByEthOrSolAddress({
		addresses: [address],
		viewerFid,
	});
	const userArray = data[address.toLowerCase()];
	return userArray && userArray.length > 0 ? userArray[0] : undefined;
};

/**
 * Create a webhook in Neynar, creating the subscription for the trade.created event
 * @param webhookNumber - The number of the webhook
 * @param webhookUrl - The URL of the webhook
 * @param fids - The FIDs of the users to add to the webhook
 * @param minNeynarScore - The minimum Neynar score of the users to add to the webhook
 * @param minTokenAmountUSDC - The minimum token amount in USDC of the users to add to the webhook
 * @returns
 */
export const createNeynarWebhookTradeCreated = async ({
	webhookNumber,
	webhookUrl,
	fids,
	minNeynarScore,
	minTokenAmountUSDC,
}: {
	webhookNumber: number;
	webhookUrl: string;
	fids: number[];
	minNeynarScore?: number;
	minTokenAmountUSDC?: number;
}) => {
	const data = await ky
		.post<NeynarWebhookResponse>(
			"https://api.neynar.com/v2/farcaster/webhook",
			{
				headers: {
					"x-api-key": env.NEYNAR_API_KEY,
				},
				json: {
					name: `Alphie webhook #${webhookNumber}`,
					url: webhookUrl,
					subscription: {
						"trade.created": {
							fids,
							minimum_trader_neynar_score: minNeynarScore,
							minimum_token_amount_usdc: minTokenAmountUSDC,
						},
					},
				},
			},
		)
		.json();
	return data;
};

/**
 * Update a webhook in Neynar, updating the subscription for the trade.created event
 * @param webhookId - The ID of the webhook to update
 * @param fids - The FIDs of the users to add to the webhook
 * @param minNeynarScore - The minimum Neynar score of the users to add to the webhook
 * @param minTokenAmountUSDC - The minimum token amount in USDC of the users to add to the webhook
 * @returns
 */
export const updateNeynarWebhookTradeCreated = async ({
	webhookId,
	fids,
	minNeynarScore,
	minTokenAmountUSDC,
}: {
	webhookId: string;
	fids: number[];
	minNeynarScore?: number;
	minTokenAmountUSDC?: number;
}) => {
	const minimum_trader_neynar_score =
		minNeynarScore && minNeynarScore >= 0 && minNeynarScore <= 1
			? minNeynarScore
			: undefined;
	const data = await ky
		.put<NeynarWebhookResponse>("https://api.neynar.com/v2/farcaster/webhook", {
			headers: {
				"x-api-key": env.NEYNAR_API_KEY,
			},
			json: {
				webhook_id: webhookId,
				subscription: {
					"trade.created": {
						fids,
						minimum_trader_neynar_score,
						minimum_token_amount_usdc: minTokenAmountUSDC,
					},
				},
			},
		})
		.json();

	return data;
};

/**
 * Delete a webhook from Neynar
 * @param webhookId - The ID of the webhook to delete
 * @returns
 */
export const deleteNeynarWebhook = async ({
	webhookId,
}: {
	webhookId: string;
}) => {
	const data = await neynarClient.deleteWebhook({
		webhookId,
	});
	return data;
};

/**
 * Verify a Neynar signature
 * @param signature - The signature to verify
 * @param body - The body to verify
 * @returns
 */
export const verifyNeynarSignature = ({
	signature,
	body,
}: {
	signature: string;
	body: string;
}) => {
	if (!signature) return false;
	const hmac = createHmac("sha512", env.NEYNAR_WEBHOOK_SECRET);
	hmac.update(body);
	const calculatedSignature = hmac.digest("hex");
	const isValid = calculatedSignature === signature;
	return isValid;
};
