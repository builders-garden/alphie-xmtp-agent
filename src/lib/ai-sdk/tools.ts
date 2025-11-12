import type { User as NeynarUser } from "@neynar/nodejs-sdk/build/api/index.js";
import { tool } from "ai";
import { z } from "zod";
import { HELP_HINT_MESSAGE } from "../constants.js";
import { getOrCreateUserByFarcasterFid } from "../db/queries/index.js";
import { getAddressFromBasename, getAddressFromEnsName } from "../ens.js";
import {
	fetchUserFromNeynarByAddress,
	fetchUserFromNeynarByFid,
	searchUserByUsername,
} from "../neynar.js";

export const tools = {
	alphie_track: tool({
		description: "Track a new user's activity on the blockchain",
		inputSchema: z.object({
			farcasterUsername: z
				.string()
				.optional()
				.nullable()
				.describe(
					"The Farcaster username of the person to track, the username can also be an Ethereum ENS name"
				),
			farcasterFid: z
				.number()
				.optional()
				.nullable()
				.describe("The Farcaster FID of the person to track"),
			ethereumAddress: z
				.string()
				.optional()
				.nullable()
				.describe(
					"The Ethereum address of the person to track, starting with 0x"
				),
		}),
		execute: async ({ farcasterFid, farcasterUsername, ethereumAddress }) => {
			console.log(
				"[ai-sdk] [track-tool] track this farcaster user",
				farcasterFid,
				farcasterUsername
			);
			let user: NeynarUser | null = null;
			if (farcasterFid) {
				user = await fetchUserFromNeynarByFid(farcasterFid);
			} else if (farcasterUsername) {
				user = await searchUserByUsername(farcasterUsername);
				if (!user) {
					let username = farcasterUsername;
					if (farcasterUsername.endsWith(".base.eth")) {
						username = username.slice(0, -1 * ".base.eth".length);
						const tmpUser = await searchUserByUsername(username);
						if (tmpUser) {
							user = tmpUser;
						} else {
							const address = await getAddressFromBasename(username);
							if (address) {
								const userBasename =
									await fetchUserFromNeynarByAddress(address);
								if (userBasename) {
									user = userBasename;
								}
							}
						}
					} else if (farcasterUsername.endsWith(".eth")) {
						username = username.slice(0, -1 * ".eth".length);
						const tmpUser = await searchUserByUsername(username);
						if (tmpUser) {
							user = tmpUser;
						} else {
							const address = await getAddressFromEnsName(username);
							if (address) {
								const userEns = await fetchUserFromNeynarByAddress(address);
								if (userEns) {
									user = userEns;
								}
							}
						}
					}
				}
			} else if (ethereumAddress) {
				user = (await fetchUserFromNeynarByAddress(ethereumAddress)) ?? null;
			} else {
				return {
					farcasterUser: undefined,
					text: "Provide  a Farcaster username, FID or Ethereum address and try again",
				};
			}
			if (!user) {
				return {
					farcasterUser: undefined,
					text: "No farcaster user found for the given input",
				};
			}
			// create user from neynar
			const newUser = await getOrCreateUserByFarcasterFid(user);
			if (!newUser) {
				return {
					farcasterUser: undefined,
					text: `Unable to save user @${user.username} in db`,
				};
			}
			console.log("[ai-sdk] [track-tool] user saved in db", newUser.id);

			return {
				farcasterUser: {
					fid: user.fid,
					username: user.username,
					userId: newUser.id,
				},
				text: `User to track: https://farcaster.xyz/${user.username} (fid ${user.fid})`,
			};
		},
	}),
	alphie_default: tool({
		description:
			"Default response when the request is not related to the tracking of new users",
		inputSchema: z.object({}),
		execute: async () => {
			return HELP_HINT_MESSAGE;
		},
	}),
};
