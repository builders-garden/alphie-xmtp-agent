import { z } from "zod";
import type { HandleCopyTradeSchema } from "./server.type.js";

export enum QUEUES {
	NEYNAR_WEBHOOK_QUEUE = "neynar-webhook-queue",
	MESSAGE_QUEUE = "message-queue",
}

export interface NeynarWebhookJobData {
	user: HandleCopyTradeSchema["user"];
	transaction: HandleCopyTradeSchema["transaction"];
}

const neynarWebhookJobResultSuccessSchema = z.object({
	status: z.literal("success"),
	message: z.string(),
});

const neynarWebhookJobResultFailedSchema = z.object({
	status: z.literal("failed"),
	error: z.string(),
});

export const neynarWebhookJobResultSchema = z.union([
	neynarWebhookJobResultSuccessSchema,
	neynarWebhookJobResultFailedSchema,
]);

export type NeynarWebhookJobResult = z.infer<
	typeof neynarWebhookJobResultSchema
>;

const neynarWebhookJobProgressPendingSchema = z.object({
	status: z.literal("pending"),
	progress: z.number(),
});

const neynarWebhookJobProgressActiveSchema = z.object({
	status: z.literal("active"),
	progress: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const neynarWebhookJobProgressCompletedSchema = z.object({
	status: z.literal("completed"),
	progress: z.number(),
	result: neynarWebhookJobResultSchema,
	createdAt: z.date(),
	updatedAt: z.date(),
});

const neynarWebhookJobProgressFailedSchema = z.object({
	status: z.literal("failed"),
	progress: z.number(),
	error: z.string(),
	result: neynarWebhookJobResultSchema,
	attemptsMade: z.number(),
	attemptsRemaining: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const neynarWebhookJobProgressDelayedSchema = z.object({
	status: z.literal("delayed"),
	progress: z.number(),
	delayReason: z.string(),
	processAt: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const neynarWebhookJobProgressWaitingSchema = z.object({
	status: z.literal("waiting"),
	progress: z.number(),
	position: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const neynarWebhookJobProgressSchema = z.union([
	neynarWebhookJobProgressPendingSchema,
	neynarWebhookJobProgressActiveSchema,
	neynarWebhookJobProgressCompletedSchema,
	neynarWebhookJobProgressFailedSchema,
	neynarWebhookJobProgressDelayedSchema,
	neynarWebhookJobProgressWaitingSchema,
]);

export type NeynarWebhookJobProgress = z.infer<
	typeof neynarWebhookJobProgressSchema
>;
