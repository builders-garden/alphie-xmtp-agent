import {
	type DecodedMessage,
	type GroupMember,
	IdentifierKind,
} from "@xmtp/agent-sdk";
import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";
import { fromString } from "uint8arrays";
import { ulid } from "ulid";
/**
 * Get encryption key from string
 * @param encryptionKey - The encryption key string
 * @returns The encryption key
 */
export const getEncryptionKeyFromString = (encryptionKey: string) => {
	return fromString(encryptionKey);
};

/**
 * Format the avatar src for imagedelivery.net images to reasonable avatar sizes
 *
 * @docs https://developers.cloudflare.com/images/transform-images/transform-via-url/#options
 *
 * @param avatarSrc - The src of the avatar
 * @returns The formatted avatar src
 */
export const formatAvatarSrc = (src: string) => {
	let avatarSrc = src;
	if (avatarSrc.startsWith("https://imagedelivery.net")) {
		const defaultAvatar = "/anim=false,fit=contain,f=auto,w=512";
		if (avatarSrc.endsWith("/rectcrop3")) {
			avatarSrc = avatarSrc.replace("/rectcrop3", defaultAvatar);
		} else if (avatarSrc.endsWith("/original")) {
			avatarSrc = avatarSrc.replace("/original", defaultAvatar);
		} else if (avatarSrc.endsWith("/public")) {
			avatarSrc = avatarSrc.replace("/public", defaultAvatar);
		}
	}
	return avatarSrc;
};

/**
 * Convert XMTP messages to AI model messages
 * @param messages - The XMTP messages to convert
 * @param agentInboxId - The inbox ID of the agent
 * @returns The AI model messages for the given XMTP messages
 */
export const convertXmtpToAiModelMessages = ({
	messages,
	agentInboxId,
	agentAddress,
	xmtpMembers,
}: {
	messages: DecodedMessage[];
	agentInboxId: string;
	agentAddress: string;
	xmtpMembers: GroupMember[];
}): ModelMessage[] => {
	const inboxIdMap = new Map(
		xmtpMembers.map((member) => [member.inboxId, member.accountIdentifiers]),
	);

	const uiMessages: UIMessage[] = messages.map((msg) => {
		const userAddress = inboxIdMap
			.get(msg.senderInboxId)
			?.find((id) => id.identifierKind === IdentifierKind.Ethereum)?.identifier;
		const isAgent =
			msg.senderInboxId.toLowerCase() === agentInboxId.toLowerCase() ||
			userAddress === agentAddress;

		return {
			id: msg.id || ulid(),
			role: isAgent ? "assistant" : "user",
			parts: [
				{
					type: "text",
					text: isAgent
						? JSON.stringify(`Alphie (me): ${msg.content}`)
						: JSON.stringify(
								`User ${userAddress || msg.senderInboxId}: ${msg.content}`,
							),
					state: "done" as const,
				},
			],
		};
	});
	const modelMessages = convertToModelMessages(uiMessages);
	return modelMessages;
};
