import { createOpenAI } from "@ai-sdk/openai";
import type { User as NeynarUser } from "@neynar/nodejs-sdk/build/api/index.js";
import type {
	DecodedMessage,
	GroupMember,
	MessageContext,
} from "@xmtp/agent-sdk";
import { generateText, tool } from "ai";
import { z } from "zod";
import {
	convertXmtpToAiModelMessages,
	getXmtpActions,
	sendActions,
	sendConfirmation,
} from "../utils/index.js";
import { HELP_HINT_MESSAGE, SYSTEM_PROMPT } from "./constants.js";
import {
	addUserToGroupTrackingByFid,
	getOrCreateUserByFarcasterFid,
} from "./db/queries/index.js";
import { env } from "./env.js";
import { fetchUserFromNeynarByFid, searchUserByUsername } from "./neynar.js";

const openai = createOpenAI({
	baseURL: "https://api.openai.com/v1",
	name: "openai",
	apiKey: env.OPENAI_API_KEY,
});

const tools = {
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

/**
 * Generate answer using AI
 * @param message - The message to generate answer for
 * @param messages - The messages to use as context
 * @returns
 */
export const aiGenerateAnswer = async ({
	message,
	xmtpMessages,
	xmtpMembers,
	agentAddress,
	xmtpContext,
}: {
	message: string;
	xmtpMessages: DecodedMessage[];
	xmtpMembers: GroupMember[];
	agentAddress: string;
	xmtpContext: MessageContext;
}) => {
	const modelMessages = convertXmtpToAiModelMessages({
		messages: xmtpMessages,
		agentInboxId: xmtpContext.client.inboxId,
		agentAddress,
		xmtpMembers,
	});
	// 1. generate text with ai
	const response = await generateText({
		model: openai("gpt-4.1-mini"),
		system: SYSTEM_PROMPT,
		messages: [...modelMessages, { role: "user", content: message }],
		tools,
	});

	// 2. parse the output
	const outputStep = response.steps[0].content.find(
		(part) => part.type === "tool-result",
	);
	if (outputStep) {
		const outputText = (outputStep.output as string) ?? response.text;
		console.log("Output Text:", outputText);

		const toolName = outputStep.toolName;
		// 2.a help tool
		if (toolName === "help") {
			const xmtpActions = getXmtpActions();
			await sendActions(xmtpContext, xmtpActions);
			return outputText;
		}
		// 2.b track tool
		if (toolName === "alphie_track") {
			const trackOutput = outputStep.output as unknown as
				| {
						farcasterUser: undefined;
						text: string;
				  }
				| {
						farcasterUser: {
							fid: number;
							username: string;
						};
						text: string;
				  };
			if (trackOutput.farcasterUser) {
				await sendConfirmation({
					ctx: xmtpContext,
					message: `Confirm to start tracking @${trackOutput.farcasterUser.username} (${trackOutput.farcasterUser.fid})?`,
					onYes: async (ctx) => {
						// add user to group tracking
						await addUserToGroupTrackingByFid({
							conversationId: xmtpContext.conversation.id,
							userFid: trackOutput.farcasterUser.fid,
							addedByUserInboxId: xmtpContext.client.inboxId,
						});
						await ctx.sendText("User added to group trackings!");
					},
					onNo: async (ctx) => await ctx.sendText("Ok, operation cancelled"),
				});
			}
			return trackOutput.text;
		}
		return outputText;
	}

	// 3. no tool call, return the text
	return response.text;
};
