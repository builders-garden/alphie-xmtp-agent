import { Redis } from "ioredis";
import { env } from "./env.js";

// this prevents BullMq from losing sync with Redis state
//  (enable double stack lookup using family=0)
const redis = new Redis(`${env.REDIS_URL}?family=0`, {
	maxRetriesPerRequest: null,
});

redis.on("error", (err) => {
	console.error("[REDIS] error:", err);
});

export const redisConnection = redis;
