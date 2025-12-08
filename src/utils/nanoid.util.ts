import { customAlphabet } from "nanoid";

// 1% probability of collision at 8M ids: using alphabet 0-9a-z for 10 characters
export const generateShortId = customAlphabet(
	"0123456789abcdefghijklmnopqrstuvwxyz",
	10
);
