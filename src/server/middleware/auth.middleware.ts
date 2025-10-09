import type { NextFunction, Request, Response } from "express";
import { verifyNeynarSignature } from "../../lib/neynar.js";
import { response } from "./response.js";

export const validateApiSecret = (
	req: Request,
	_res: Response,
	next: NextFunction,
): void | Promise<void> => {
	const signature = req.header("X-Neynar-Signature");
	const body = req.body;
	console.log("signature", signature);
	console.log("body", body);

	if (!signature || !body) {
		console.log("Unauthorized: Invalid or missing signature or body");
		response.unauthorized({
			message: "Unauthorized: Invalid or missing signature or body",
		});
		return;
	}

	const isValid = verifyNeynarSignature({
		signature,
		body,
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
