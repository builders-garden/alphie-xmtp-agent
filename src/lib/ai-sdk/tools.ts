import type { User as NeynarUser } from "@neynar/nodejs-sdk/build/api/index.js";
import { tool } from "ai";
import { z } from "zod";
import { HELP_HINT_MESSAGE } from "../constants.js";
import { getOrCreateUserByFarcasterFid } from "../db/queries/index.js";
import { fetchUserFromNeynarByFid, searchUserByUsername } from "../neynar.js";

export const tools = {
	alphie_track: tool({
		description: "Track a new user's activity on the blockchain",
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
			console.log(
				"[ai-sdk] [track-tool] track this farcaster user",
				farcasterFid,
				farcasterUsername,
			);
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
			const newUser = await getOrCreateUserByFarcasterFid(user);
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
