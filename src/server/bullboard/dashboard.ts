import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { env } from "../../lib/env.js";
import { neynarWebhookQueue } from "./queues/neynar.queue.js";

export const getBullboardRouter = (basePath: string) => {
	console.log(`🧭 Bull Board: http://localhost:${env.PORT}${basePath}`);

	const serverAdapter = new ExpressAdapter();
	serverAdapter.setBasePath(basePath);

	createBullBoard({
		queues: [
			new BullMQAdapter(neynarWebhookQueue, {
				allowRetries: true,
			}),
		],
		serverAdapter,
	});
	return serverAdapter.getRouter();
};
