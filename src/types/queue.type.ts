import { z } from "zod";
import type { HandleCopyTradeSchema } from "./server.type.js";

export enum QUEUES {
	NEYNAR_WEBHOOK_QUEUE = "neynar-webhook-queue",
	UPDATE_USERS_QUEUE = "update-users-queue",
}

export interface QueueUser {
	fid: number;
	userId: string;
	groupId?: string;
}

export interface UpdateUsersJobData {
	addUsers: QueueUser[];
	removeUsers: QueueUser[];
}

export interface NeynarWebhookJobData {
	user: HandleCopyTradeSchema["user"];
	transaction: HandleCopyTradeSchema["transaction"];
}

const jobResultSuccessSchema = z.object({
	status: z.literal("success"),
	message: z.string(),
});

const jobResultFailedSchema = z.object({
	status: z.literal("failed"),
	error: z.string(),
});

export const jobResultSchema = z.union([
	jobResultSuccessSchema,
	jobResultFailedSchema,
]);

export type JobResult = z.infer<typeof jobResultSchema>;

const jobProgressPendingSchema = z.object({
	status: z.literal("pending"),
	progress: z.number(),
});

const jobProgressActiveSchema = z.object({
	status: z.literal("active"),
	progress: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const jobProgressCompletedSchema = z.object({
	status: z.literal("completed"),
	progress: z.number(),
	result: jobResultSchema,
	createdAt: z.date(),
	updatedAt: z.date(),
});

const jobProgressFailedSchema = z.object({
	status: z.literal("failed"),
	progress: z.number(),
	error: z.string(),
	result: jobResultSchema,
	attemptsMade: z.number(),
	attemptsRemaining: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const jobProgressDelayedSchema = z.object({
	status: z.literal("delayed"),
	progress: z.number(),
	delayReason: z.string(),
	processAt: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const jobProgressWaitingSchema = z.object({
	status: z.literal("waiting"),
	progress: z.number(),
	position: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const jobProgressSchema = z.union([
	jobProgressPendingSchema,
	jobProgressActiveSchema,
	jobProgressCompletedSchema,
	jobProgressFailedSchema,
	jobProgressDelayedSchema,
	jobProgressWaitingSchema,
]);

export type JobProgress = z.infer<typeof jobProgressSchema>;
