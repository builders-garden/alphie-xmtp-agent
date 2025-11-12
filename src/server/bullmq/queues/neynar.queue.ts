import { Queue } from "bullmq";
import { redisConnection } from "../../../lib/redis.js";
import { type NeynarWebhookJobData, QUEUES } from "../../../types/index.js";

export const neynarWebhookQueue = new Queue<NeynarWebhookJobData>(
	QUEUES.NEYNAR_WEBHOOK_QUEUE,
	{
		connection: redisConnection,
		defaultJobOptions: {
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 2000,
			},
			removeOnComplete: {
				count: 50, // Keep last 100 completed jobs
				age: 24 * 3600, // Remove completed jobs after 24 hours
			},
			removeOnFail: {
				count: 50, // Keep last 50 failed jobs
				age: 7 * 24 * 3600, // Remove failed jobs after 7 days
			},
		},
	}
);
