import { db } from "../index.js";
import { userTable } from "../db.schema.js";
import { eq } from "drizzle-orm";

/**
 * Get user by address
 */
export const getUserByAddress = async (address: string) => {
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.address, address),
	});
	return user;
};
