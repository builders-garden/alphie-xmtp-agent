import type { NextFunction, Response } from "express";
import { env } from "../../lib/env.js";
import type { RequestWithRawBody } from "../../types/index.js";
import { verifyNeynarSignature } from "../../utils/hmac.util.js";
import { response } from "./response.js";

/**
 * Verify a Neynar signature
 * @param req - The request object
 * @param _res - The response object
 * @param next - The next function
 * @returns void or Promise<void>
 */
export const verifyNeynarSignatureMiddleware = (
	req: RequestWithRawBody,
	_res: Response,
	next: NextFunction
): void | Promise<void> => {
	if (
		env.NODE_ENV === "development" ||
		req.method === "GET" ||
		req.method === "OPTIONS" ||
		req.method === "HEAD"
	) {
		next();
		return;
	}

	const signature = req.header("X-Neynar-Signature");
	if (!signature) {
		console.log("Unauthorized: Invalid or missing signature or body");
		response.unauthorized({
			message: "Unauthorized: Invalid or missing signature or body",
		});
		return;
	}

	const isValid = verifyNeynarSignature({
		signature,
		rawBody: req.rawBody ?? "",
	});

	if (!isValid) {
		console.log("Unauthorized: Invalid signature");
		response.unauthorized({
			message: "Unauthorized: Invalid signature",
		});
		return;
	}

	next();
};

/**
 *
 * @param req - The request object
 * @param _res - The response object
 * @param next - The next function
 * @returns void or Promise<void>
 */
export const verifyApiKeyMiddleware = (
	req: RequestWithRawBody,
	_res: Response,
	next: NextFunction
): void | Promise<void> => {
	if (env.NODE_ENV === "development") {
		next();
		return;
	}

	const apiKey = req.header("x-api-secret");
	if (!apiKey || apiKey !== env.API_KEY_SECRET) {
		console.log("Unauthorized: Invalid or missing API secret");
		response.unauthorized({
			message: "Unauthorized: Invalid or missing API secret",
		});
		return;
	}

	next();
};
