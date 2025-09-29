import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../env.js";
import * as dbSchema from "./db.schema.js";

export const tursoClient = createClient({
	url: env.DATABASE_URL,
	authToken: env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(tursoClient, {
	schema: { ...dbSchema },
});
