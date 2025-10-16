import { createOpenAI } from "@ai-sdk/openai";
import type { MessageContext } from "@xmtp/agent-sdk";
import { generateText } from "ai";
import { getXmtpActions, sendActions, sendConfirmation } from "../../utils/index.js";
import { updateUsersToQueue } from "../../utils/queue.util.js";
import { DEFAULT_ACTIONS_MESSAGE, DEFAULT_RESPONSE_MESSAGE, SYSTEM_PROMPT } from "../constants.js";
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
	//xmtpMessages,
	//xmtpMembers,
	//agentAddress,
	xmtpContext,
}: {
	message: string;
	//xmtpMessages: DecodedMessage[];
	//xmtpMembers: GroupMember[];
	//agentAddress: string;
	xmtpContext: MessageContext;
}) => {
	/*
	const modelMessages = convertXmtpToAiModelMessages({
		messages: xmtpMessages,
		agentInboxId: xmtpContext.client.inboxId,
		agentAddress,
		xmtpMembers,
	});
	*/
	// 1. generate text with ai
	const response = await generateText({
		model: openai("gpt-4.1-mini"),
		system: SYSTEM_PROMPT,
		messages: [/*...modelMessages,*/ { role: "user", content: message }],
		tools,
	});

	// 2. parse the output
	const outputStep = response.steps[0].content.find(
		(part) => part.type === "tool-result",
	);
	console.log("Output Step:", outputStep);
	if (outputStep) {
		const outputText = (outputStep.output as string) ?? response.text;
		console.log("Output Text:", outputText);

		const toolName = outputStep.toolName;
		/*
		// 2.a help tool
		if (toolName === "alphie_help") {
			const xmtpActions = getXmtpActions();
			await sendActions(xmtpContext, xmtpActions);
			return outputText;
		}
		*/
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
							userId: string;
						};
						text: string;
				  };
			if (trackOutput.farcasterUser) {
				await sendConfirmation({
					ctx: xmtpContext,
					message: `Confirm to start tracking @${trackOutput.farcasterUser.username} (fid ${trackOutput.farcasterUser.fid})?`,
					onYes: async (ctx) => {
						// add job to update neynar webhook with new user fid
						const job = await updateUsersToQueue({
							addUsers: [
								{
									fid: trackOutput.farcasterUser.fid,
									userId: trackOutput.farcasterUser.userId,
									groupId: xmtpContext.conversation.id,
								},
							],
						});
						console.log(`[ai-sdk] Job added to add users queue: ${job.id}`);
						await ctx.sendText("User added to group trackings!");
					},
					onNo: async (ctx) => await ctx.sendText("Ok, operation cancelled"),
				});
			}
			return trackOutput.text;
		}
		
		// 2.c default tool
		const xmtpActions = getXmtpActions({ message: DEFAULT_ACTIONS_MESSAGE});
		await sendActions(xmtpContext, xmtpActions);
		return;
	}

	// 3. no tool call, return the text
	//return DEFAULT_RESPONSE_MESSAGE;
	return DEFAULT_RESPONSE_MESSAGE;
};
