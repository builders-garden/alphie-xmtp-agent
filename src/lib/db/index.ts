import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as dbSchema from "./db.schema.js";
import { env } from "../env.js";

export const tursoClient = createClient({
	url: env.DATABASE_URL,
	authToken: env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(tursoClient, {
	schema: { ...dbSchema },
});
