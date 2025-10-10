import { Worker } from "bullmq";
import { redisConnection } from "../../../lib/redis.js";
import {
	type JobResult,
	type NeynarWebhookJobData,
	QUEUES,
} from "../../../types/index.js";
import { processNeynarWebhookJob } from "../jobs/neynar.job.js";

export const neynarWebhookWorker = new Worker<NeynarWebhookJobData, JobResult>(
	QUEUES.NEYNAR_WEBHOOK_QUEUE,
	async (job) => {
		try {
			console.log(
				`| neynar-webhook-worker | processing job #${job.id} | userId: ${job.data.user.fid} | txHash: ${job.data.transaction.transactionHash}`,
			);

			const result = await processNeynarWebhookJob(job);

			console.log(
				`| neynar-webhook-worker | completed job #${job.id} | txHash: ${result.status}`,
			);

			return result;
		} catch (error) {
			console.error(`| neynar | failed job #${job.id} |`, error);
			throw error;
		}
	},
	{
		connection: redisConnection,
		concurrency: 2, // Process up to 2 videos simultaneously
		limiter: {
			max: 10,
			duration: 60000, // Max 10 jobs per minute
		},
		stalledInterval: 30000, // Check for stalled jobs every 30 seconds (default is 30 seconds)
		maxStalledCount: 3, // Allow job to stall 3 times before marking as failed (default is 1)
	},
);

neynarWebhookWorker.on("completed", (job) => {
	console.log(`✅ neynar-webhook-worker #${job.id} completed successfully`);
});

neynarWebhookWorker.on("failed", (job, err) => {
	console.error(`❌ neynar-webhook-worker #${job?.id} failed:`, err);
});

neynarWebhookWorker.on("progress", (job, progress) => {
	console.log(`⏳ neynar-webhook-worker #${job.id} progress: ${progress}%`);
});

neynarWebhookWorker.on("error", (err) => {
	console.error("neynar-webhook-worker error:", err);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
	console.log("SIGTERM received, closing neynar-webhook-worker...");
	await neynarWebhookWorker.close();
	console.log("SIGTERM neynar-webhook-worker closed");
});

process.on("SIGINT", async () => {
	console.log("SIGINT received, closing neynar-webhook-worker...");
	await neynarWebhookWorker.close();
	console.log("SIGINT neynar-webhook-worker closed");
});
