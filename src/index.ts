import { logDetails } from "@xmtp/agent-sdk/debug";
import cookieParserMiddleware from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morganLogger from "morgan";
import { base } from "viem/chains";
import { env } from "./lib/env.js";
import { createXmtpAgent, handleXmtpMessage } from "./lib/xmtp/agent.js";
import { inlineActionsMiddleware } from "./lib/xmtp/middlewares.js";
import { validateApiSecret } from "./server/middleware/auth.middleware.js";
import {
	handleError,
	handleNotFound,
} from "./server/middleware/error.middleware.js";
import responseMiddleware from "./server/middleware/response.js";
import neynarRoutes from "./server/routes/neynar.route.js";

import { registerXmtpActions } from "./utils/index.js";

async function main() {
	const app = express();
	const port = env.PORT;
	const allowedOrigins = ["*"];

	// Middlewares
	app.use(
		cors({
			origin: allowedOrigins,
			credentials: true,
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		}),
	);
	app.use(cookieParserMiddleware());
	app.use(express.json());
	app.use(helmet());
	app.use(morganLogger("dev"));
	app.use(responseMiddleware);

	app.get("/", (_req, res) => {
		res.json({ status: "ok" });
	});

	app.use("/api/v1/", validateApiSecret, neynarRoutes);

	// Use custom middlewares for handling 404 and errors
	app.use(handleNotFound);
	app.use(handleError);

	console.log("🦊 Alphie XMTP Agent started 🗿");
	console.log(`📡 Connected to: ${base.name}`);

	// Create agent using environment variables
	const xmtpAgent = await createXmtpAgent();

	// get agent address
	const agentAddress = xmtpAgent.address;
	if (!agentAddress) {
		console.error("❌ Unable to get xmtp agent address");
		throw new Error("Unable to get xmtp agent address");
	}

	registerXmtpActions();

	// XMTP Agent middlewares
	xmtpAgent.use(inlineActionsMiddleware);

	xmtpAgent.on("message", async (ctx) => {
		console.log(`Message received: ${JSON.stringify(ctx.message.content)}`);
		await handleXmtpMessage(ctx, agentAddress);
	});

	xmtpAgent.on("group", async (ctx) => {
		console.log(`Group received: ${JSON.stringify(ctx)}`);
	});

	xmtpAgent.on("group-update", async (ctx) => {
		console.log(`Group update received: ${JSON.stringify(ctx)}`);
	});

	xmtpAgent.on("unknownMessage", async (ctx) => {
		console.log(`Unknown message received: ${JSON.stringify(ctx)}`);
	});

	xmtpAgent.on("unhandledError", async (ctx) => {
		console.log(`Unhandled error received: ${JSON.stringify(ctx)}`);
	});

	// Handle startup
	xmtpAgent.on("start", async () => {
		console.log("🦊 Alphie XMTP Agent is running...");
		logDetails(xmtpAgent.client);
	});

	await xmtpAgent.start();

	app.listen(port, () => {
		console.log(`🚀 Webhook Server is running at http://localhost:${port}`);
	});
}

main().catch((error) => {
	console.error(error);
	throw error;
});
