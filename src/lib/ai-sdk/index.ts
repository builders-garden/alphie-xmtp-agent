import { createOpenAI } from "@ai-sdk/openai";
import type {
	DecodedMessage,
	GroupMember,
	MessageContext,
} from "@xmtp/agent-sdk";
import { generateText } from "ai";
import {
	convertXmtpToAiModelMessages,
	getXmtpActions,
	sendActions,
	sendConfirmation,
} from "../../utils/index.js";
import { SYSTEM_PROMPT } from "../constants.js";
import { addUserToGroupTrackingByFid } from "../db/queries/index.js";
import { env } from "../env.js";
import { tools } from "./tools.js";

const openai = createOpenAI({
	baseURL: "https://api.openai.com/v1",
	name: "openai",
	apiKey: env.OPENAI_API_KEY,
});

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
