import { createOpenAI } from "@ai-sdk/openai";
import type { MessageContext } from "@xmtp/agent-sdk";
import { generateText, type ModelMessage, tool } from "ai";
import { z } from "zod";
import type { ActionsContent } from "../types/actions-content.js";
import { sendActions } from "../utils/inline-actions.js";
import { HELP_HINT_MESSAGE, SYSTEM_PROMPT } from "./constants.js";
import { env } from "./env.js";

const openai = createOpenAI({
	baseURL: "https://api.openai.com/v1",
	name: "openai",
	apiKey: env.OPENAI_API_KEY,
});

const tools = {
	alphie_track: tool({
		description: "Track a person's trade on the blockchain",
		inputSchema: z.object({
			farcasterFid: z
				.string()
				.optional()
				.nullable()
				.describe("The Farcaster FID of the person to track"),
			address: z
				.string()
				.optional()
				.nullable()
				.describe("The Ethereum address of the person to track"),
			ensName: z
				.string()
				.optional()
				.nullable()
				.describe("The Ethereum ENS name of the person to track"),
			farcasterUsername: z
				.string()
				.optional()
				.nullable()
				.describe("The Farcaster username of the person to track"),
		}),
		execute: async ({ farcasterFid, address, ensName, farcasterUsername }) => {
			const data = {
				farcasterFid,
				address,
				ensName,
				farcasterUsername,
			};
			return `Tracked ${JSON.stringify(data)}'s trade on the blockchain`;
		},
	}),
	leaderboard: tool({
		description: "Get the leaderboard of the group",
		inputSchema: z.object({}),
		execute: async () => {
			return "Leaderboard of the group\n\n1. @alice: 100\n2. @bob: 90\n3. @charlie: 80";
		},
	}),
	help: tool({
		description: "Get the help of the group",
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
	messages,
	xmtpContext,
	xmtpActions,
}: {
	message: string;
	messages: ModelMessage[];
	xmtpContext: MessageContext;
	xmtpActions: ActionsContent;
}) => {
	const response = await generateText({
		model: openai("gpt-4.1-mini"),
		system: SYSTEM_PROMPT,
		messages: [...messages, { role: "user", content: message }],
		tools,
	});
	console.log("AI Response:", JSON.stringify(response, null, 2));
	const outputStep = response.steps[0].content.find(
		(part) => part.type === "tool-result",
	);
	if (outputStep) {
		const outputText = (outputStep.output as string) ?? response.text;
		console.log("Output Text:", outputText);

		const toolName = outputStep.toolName;
		if (toolName === "help") {
			await sendActions(xmtpContext, xmtpActions);
			return outputText;
		}
		return outputText;
	}

	return response.text;
};
