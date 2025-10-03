import { Redis } from "ioredis";
import { env } from "./env.js";

// this prevents BullMq from losing sync with Redis state
const redis = new Redis(env.REDIS_URL, {
	maxRetriesPerRequest: null,
});

redis.on("error", (err) => {
	console.error("[REDIS] error:", err);
});

export const redisConnection = redis;
