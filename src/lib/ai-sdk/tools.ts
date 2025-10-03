import type { User as NeynarUser } from "@neynar/nodejs-sdk/build/api/index.js";
import { tool } from "ai";
import { z } from "zod";
import { HELP_HINT_MESSAGE } from "../constants.js";
import { getOrCreateUserByFarcasterFid } from "../db/queries/index.js";
import { fetchUserFromNeynarByFid, searchUserByUsername } from "../neynar.js";

export const tools = {
	alphie_track: tool({
		description: "Track a person's trade on the blockchain",
		inputSchema: z.object({
			farcasterUsername: z
				.string()
				.optional()
				.nullable()
				.describe(
					"The Farcaster username of the person to track, the username can also be an Ethereum ENS name",
				),
			farcasterFid: z
				.number()
				.optional()
				.nullable()
				.describe("The Farcaster FID of the person to track"),
		}),
		execute: async ({ farcasterFid, farcasterUsername }) => {
			console.log("track this farcaster user", farcasterFid, farcasterUsername);
			let user: NeynarUser | null = null;
			if (farcasterFid) {
				user = await fetchUserFromNeynarByFid(farcasterFid);
			} else if (farcasterUsername) {
				user = await searchUserByUsername(farcasterUsername);
			} else {
				return {
					farcasterUser: undefined,
					text: "No Farcaster username or FID provided",
				};
			}
			if (!user) {
				return {
					farcasterUser: undefined,
					text: "No user found",
				};
			}
			// create user from neynar
			await getOrCreateUserByFarcasterFid(user);

			return {
				farcasterUser: {
					fid: user.fid,
					username: user.username,
				},
				text: `Confirm that you want to track this farcaster user https://farcaster.xyz/${user.username} (${user.fid})`,
			};
		},
	}),
	leaderboard: tool({
		description: "Get the leaderboard of the group",
		inputSchema: z.object({}),
		execute: async () => {
			// TODO call endpoint to get latest leaderboard data
			const leaderboard = "1. @alice: 100\n2. @bob: 90\n3. @charlie: 80";
			return `🏆 Leaderboard of the group\n\n${leaderboard}`;
		},
	}),
	help: tool({
		description:
			"Help the user gather more information about Alphie and its features",
		inputSchema: z.object({}),
		execute: async () => {
			return HELP_HINT_MESSAGE;
		},
	}),
};
