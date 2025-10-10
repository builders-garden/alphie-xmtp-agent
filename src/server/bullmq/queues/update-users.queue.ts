import { Queue } from "bullmq";
import { redisConnection } from "../../../lib/redis.js";
import { QUEUES, type UpdateUsersJobData } from "../../../types/index.js";

export const updateUsersQueue = new Queue<UpdateUsersJobData>(
	QUEUES.UPDATE_USERS_QUEUE,
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
	},
);
