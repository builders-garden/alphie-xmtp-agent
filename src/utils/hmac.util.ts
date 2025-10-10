import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../lib/env.js";

export type UnknownObject = Record<string, unknown>;
export type Order = (o: UnknownObject | unknown[]) => UnknownObject | unknown[];

/**
 * Verify a Neynar signature
 * @param signature - The signature to verify
 * @param body - The body to verify
 * @returns
 */
export const verifyNeynarSignature = ({
	signature,
	rawBody,
}: {
	signature: string;
	rawBody: string;
}): boolean => {
	if (!signature || typeof rawBody !== "string") return false;

	const hmac = createHmac("sha512", env.NEYNAR_WEBHOOK_SECRET);
	hmac.update(rawBody);
	const computedHex = hmac.digest("hex");

	try {
		const a = Buffer.from(computedHex, "hex");
		const b = Buffer.from(signature, "hex");
		if (a.length !== b.length) return false;
		return timingSafeEqual(a, b);
	} catch {
		return false;
	}
};
