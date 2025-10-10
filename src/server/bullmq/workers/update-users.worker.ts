import { Worker } from "bullmq";
import { redisConnection } from "../../../lib/redis.js";
import {
	type JobResult,
	QUEUES,
	type UpdateUsersJobData,
} from "../../../types/index.js";
import { processAddUsersJob } from "../jobs/update-users.job.js";

export const addUsersWorker = new Worker<UpdateUsersJobData, JobResult>(
	QUEUES.UPDATE_USERS_QUEUE,
	async (job) => {
		try {
			console.log(`| update-users-worker | processing job #${job.id}`);

			const result = await processAddUsersJob(job);

			console.log(`| update-users-worker | completed job #${job.id}`);

			return result;
		} catch (error) {
			console.error(`| update-users-worker | failed job #${job.id} |`, error);
			throw error;
		}
	},
	{
		connection: redisConnection,
		concurrency: 1, // Process up to 1 job at a time
		limiter: {
			max: 10,
			duration: 60000, // Max 10 jobs per minute
		},
		stalledInterval: 30000, // Check for stalled jobs every 30 seconds (default is 30 seconds)
		maxStalledCount: 3, // Allow job to stall 3 times before marking as failed (default is 1)
	},
);

addUsersWorker.on("completed", (job) => {
	console.log(`✅ update-users-worker #${job.id} completed successfully`);
});

addUsersWorker.on("failed", (job, err) => {
	console.error(`❌ update-users-worker #${job?.id} failed:`, err);
});

addUsersWorker.on("progress", (job, progress) => {
	console.log(`⏳ update-users-worker #${job.id} progress: ${progress}%`);
});

addUsersWorker.on("error", (err) => {
	console.error("update-users-worker error:", err);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
	console.log("SIGTERM received, closing update-users-worker...");
	await addUsersWorker.close();
	console.log("SIGTERM update-users-worker closed");
});

process.on("SIGINT", async () => {
	console.log("SIGINT received, closing update-users-worker...");
	await addUsersWorker.close();
	console.log("SIGINT update-users-worker closed");
});
