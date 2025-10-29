import { z } from "zod";

export const farcasterNotificationDetailsSchema = z.object({
	appFid: z.number(),
	url: z.string(),
	token: z.string(),
});

export type FarcasterNotificationDetails = z.infer<
	typeof farcasterNotificationDetailsSchema
>;
