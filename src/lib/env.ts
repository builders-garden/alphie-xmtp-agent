import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
	// XMTP Agent
	XMTP_ENV: z
		.enum(["dev", "local", "production"])
		.optional()
		.default("production"),
	XMTP_WALLET_KEY: z.string().min(1),
	XMTP_DB_ENCRYPTION_KEY: z.string().optional(),

	// Fix Railway volume mount path
	RAILWAY_VOLUME_MOUNT_PATH: z.string().optional().default("."),

	// Database
	DATABASE_URL: z.string().min(1),
	DATABASE_AUTH_TOKEN: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
