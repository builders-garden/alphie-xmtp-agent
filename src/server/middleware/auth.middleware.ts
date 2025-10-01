import type { NextFunction, Request, Response } from "express";
import { env } from "../../lib/env.js";
import { response } from "./response.js";

export const validateApiSecret = (
	req: Request,
	_res: Response,
	next: NextFunction,
): void | Promise<void> => {
	const apiSecret = req.header("x-api-secret");

	if (!apiSecret || apiSecret !== env.API_SECRET_KEY) {
		response.unauthorized({
			message: "Unauthorized: Invalid or missing API secret key",
		});
		return;
	}

	next();
};
