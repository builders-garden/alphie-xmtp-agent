import type { Dm, Group } from "@xmtp/agent-sdk";
import { logDetails } from "@xmtp/agent-sdk/debug";
import cookieParserMiddleware from "cookie-parser";
import cors from "cors";
import express from "express";
import basicAuth from "express-basic-auth";
import helmet from "helmet";
import morganLogger from "morgan";
import { base } from "viem/chains";
import { DEFAULT_ACTIONS_MESSAGE_2, WELCOME_MESSAGE } from "./lib/constants.js";
import {
	getOrCreateGroupByConversationId,
	getOrGroupByDmConversationId,
} from "./lib/db/queries/index.js";
import { env } from "./lib/env.js";
import { redisConnection } from "./lib/redis.js";
import {
	createXmtpAgent,
	handleXmtpTextMessage,
	handleXmtpTxReferenceEvent,
} from "./lib/xmtp/agent.js";
import {
	eyesReactionMiddleware,
	inlineActionsMiddleware,
} from "./lib/xmtp/middlewares.js";
import { getBullboardRouter } from "./server/bullmq/dashboard.js";
import {
	handleError,
	handleNotFound,
} from "./server/middleware/error.middleware.js";
import responseMiddleware from "./server/middleware/response.js";
import neynarRoutes from "./server/routes/neynar.route.js";
import trackingsRoutes from "./server/routes/trackings.route.js";
import { ContentTypeActions } from "./types/index.js";
import { getXmtpActions, registerXmtpActions } from "./utils/index.js";

// Import Bull jobs and workers to process jobs
import "./server/bullmq/jobs/index.js";
import {
	neynarWebhookWorker,
	updateUsersWorker,
} from "./server/bullmq/workers/index.js";
import {
	verifyApiKeyMiddleware,
	verifyNeynarSignatureMiddleware,
} from "./server/middleware/auth.middleware.js";
import type { RequestWithRawBody } from "./types/index.js";

async function main() {
	const app = express();
	const port = env.PORT;
	const allowedOrigins = ["*"];
	let server: ReturnType<typeof app.listen> | undefined;

	// Middlewares
	app.use(
		cors({
			origin: allowedOrigins,
			credentials: true,
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		})
	);
	app.use(cookieParserMiddleware());
	app.use(
		express.json({
			verify: (req, _res, buf) => {
				// capture raw body for HMAC verification
				(req as RequestWithRawBody).rawBody = buf.toString("utf8");
			},
		})
	);
	app.use(helmet());
	app.use(morganLogger("dev"));
	app.use(responseMiddleware);

	// Interact with BullMQ queues
	if (env.NODE_ENV === "development" && !!env.ENABLE_BULLBOARD) {
		app.use(
			"/admin/queues",
			basicAuth({
				users: {
					admin: env.BULLBOARD_PASSWORD,
				},
				challenge: true,
				unauthorizedResponse: "Unauthorized",
			}),
			getBullboardRouter("/admin/queues")
		);
	}

	app.get("/", (_req, res) => {
		res.json({ status: "ok" });
	});

	app.use("/api/v1/neynar", verifyNeynarSignatureMiddleware, neynarRoutes);
	app.use("/api/v1/trackings", verifyApiKeyMiddleware, trackingsRoutes);

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
	xmtpAgent.use(inlineActionsMiddleware, eyesReactionMiddleware);

	xmtpAgent.on("transaction-reference", async (ctx) => {
		console.log("[xmtp] New Tx reference received", ctx.message.content);
		await handleXmtpTxReferenceEvent(ctx, agentAddress);
	});

	xmtpAgent.on("text", async (ctx) => {
		console.log("[xmtp] New text message received", ctx.message.content);
		await handleXmtpTextMessage(ctx, agentAddress);
	});

	xmtpAgent.on("dm", async (ctx) => {
		const conversationId = ctx.conversation.id;
		console.log("[xmtp] New DM received", conversationId);
		const { group, isNew } = await getOrGroupByDmConversationId(
			conversationId,
			ctx.conversation as Dm,
			agentAddress,
			ctx.client.inboxId
		);
		if (isNew) {
			// If is new group, send welcome message and actions
			console.log("[xmtp] Sending welcome message to new DM", group.id);
			await ctx.conversation.send(WELCOME_MESSAGE);
			const actions = getXmtpActions({ message: DEFAULT_ACTIONS_MESSAGE_2 });
			await ctx.conversation.send(actions, ContentTypeActions);
		}
	});

	xmtpAgent.on("group", async (ctx) => {
		const conversationId = ctx.conversation.id;
		console.log("[xmtp] New group received", conversationId);
		const { group, isNew } = await getOrCreateGroupByConversationId(
			conversationId,
			ctx.conversation as Group,
			agentAddress,
			ctx.client.inboxId
		);
		if (isNew) {
			// If is new group, send welcome message and actions
			console.log("[xmtp] Sending welcome message to new group", group.id);
			await ctx.conversation.send(WELCOME_MESSAGE);
			const actions = getXmtpActions({ message: DEFAULT_ACTIONS_MESSAGE_2 });
			await ctx.conversation.send(actions, ContentTypeActions);
		}
	});

	xmtpAgent.on("unknownMessage", async (ctx) => {
		console.log("[xmtp] Unknown message received", ctx);
	});

	xmtpAgent.on("unhandledError", async (ctx) => {
		console.log("[xmtp] Unhandled error received", ctx);
	});

	// Handle startup
	xmtpAgent.on("start", async () => {
		console.log("🦊 Alphie XMTP Agent is running...");
		logDetails(xmtpAgent.client);
	});

	await xmtpAgent.start();

	// Start HTTP server and capture handle for graceful shutdown
	server = app.listen(port, () => {
		console.log(`🚀 Express.js server is running at port ${port}`);
	});

	// Unified graceful shutdown
	let isShuttingDown = false;
	const shutdown = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		console.log(`${signal} received, shutting down...`);

		const tasks: Array<Promise<unknown>> = [];

		// Close HTTP server
		tasks.push(
			new Promise<void>((resolve) => {
				if (!server) return resolve();
				server.close(() => resolve());
			})
		);

		// Stop XMTP Agent
		try {
			tasks.push(xmtpAgent.stop?.() ?? Promise.resolve());
		} catch {}

		// Close BullMQ workers
		try {
			tasks.push(updateUsersWorker.close());
			tasks.push(neynarWebhookWorker.close());
		} catch {}

		// Disconnect Redis
		tasks.push(
			(async () => {
				try {
					await redisConnection.quit();
				} catch {
					try {
						redisConnection.disconnect();
					} catch {}
				}
			})()
		);

		await Promise.allSettled(tasks);
		console.log("Shutdown complete. Exiting.");
		setTimeout(() => process.exit(0), 100).unref();
	};

	process.on("SIGINT", () => void shutdown("SIGINT"));
	process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
	console.error(error);
	throw error;
});
