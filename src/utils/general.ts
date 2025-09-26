import { fromString } from "uint8arrays";

/**
 * Get Ethereum address from inbox ID
 * @param inboxId - The inbox ID
 * @returns The Ethereum address
 */
export const getEthereumAddressFromInboxId = (inboxId: string) => {
	return inboxId.slice(0, 42);
};

/**
 * Get encryption key from string
 * @param encryptionKey - The encryption key string
 * @returns The encryption key
 */
export const getEncryptionKeyFromString = (encryptionKey: string) => {
	return fromString(encryptionKey);
};
