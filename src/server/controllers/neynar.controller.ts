import type { Job } from "bullmq";
import type { Request, Response } from "express";
import { ulid } from "ulid";
import { getAddress, type Hex } from "viem";
import type {
	JobProgress,
	JobResult,
	NeynarWebhookJobData,
} from "../../types/index.js";
import type {
	FungibleBalance,
	TokenBalanceOld,
} from "../../types/neynar.type.js";
import {
	allWebhookEventsSchema,
	testWebhookGroupTradeCreatedSchema,
} from "../../types/neynar.type.js";
import { getChainByName } from "../../utils/viem.util.js";
import { neynarWebhookQueue } from "../bullmq/queues/neynar.queue.js";

/**
 * Handle copy trade controller
 * @param req - The request object
 * @param res - The response object
 * @returns void
 */
export const handleWebhookEvent = async (req: Request, res: Response) => {
	try {
		const parseBody = allWebhookEventsSchema.safeParse(req.body);
		if (!parseBody.success) {
			console.error("Invalid request body", parseBody.error.message);
			res.status(400).json({
				status: "error",
				error: "Invalid request",
			});
			return;
		}

		const webhookEvent = parseBody.data;
		if (webhookEvent.type !== "trade.created") {
			console.warn("Invalid webhook event", webhookEvent.type);
			res.status(200).json({
				status: "success",
				message: "Invalid webhook event",
			});
			return;
		}

		const { trader, transaction } = webhookEvent.data;
		const jobId = ulid();
		if (!trader) {
			res.status(200).json({
				status: "success",
				message: "Trader is required to continue",
			});
			return;
		}

		// Add job to queue
		const chain = getChainByName(transaction.network.name);

		let receivingToken: FungibleBalance | TokenBalanceOld | undefined;
		let sendingToken: FungibleBalance | TokenBalanceOld | undefined;
		if ("receiving_token" in transaction.net_transfer) {
			receivingToken = transaction.net_transfer.receiving_token;
		} else if ("receiving_fungible" in transaction.net_transfer) {
			receivingToken = transaction.net_transfer.receiving_fungible;
		}
		if ("sending_token" in transaction.net_transfer) {
			sendingToken = transaction.net_transfer.sending_token;
		} else if ("sending_fungible" in transaction.net_transfer) {
			sendingToken = transaction.net_transfer.sending_fungible;
		}

		if (!(receivingToken && sendingToken)) {
			console.error(
				"[neynar-controller] No token found from neynar webhooktransaction",
				transaction
			);
			res.status(200).json({
				status: "failed",
				error: "No token found in transaction",
			});
			return;
		}

		// Normalize USD values across old/new webhook schemas
		const sellAmountUsdVal =
			"in_usd" in sendingToken.balance
				? sendingToken.balance.in_usd
				: sendingToken.balance.in_usdc;
		const buyAmountUsdVal =
			"in_usd" in receivingToken.balance
				? receivingToken.balance.in_usd
				: receivingToken.balance.in_usdc;

		const job = await neynarWebhookQueue.add(
			"process-neynar-webhook",
			{
				user: {
					fid: trader.fid,
				},
				transaction: {
					chainId: chain.id,
					transactionHash: transaction.hash as Hex,
					buyToken: getAddress(receivingToken.token.address),
					sellToken: getAddress(sendingToken.token.address),
					sellAmount: sendingToken.balance.in_token ?? "0",
					sellAmountUsd: sellAmountUsdVal?.toString() ?? "0",
					buyAmount: receivingToken.balance.in_token ?? "0",
					buyAmountUsd: buyAmountUsdVal?.toString() ?? "0",
					sellAmountTotSupply: sendingToken.token.total_supply ?? "0",
					buyAmountTotSupply: receivingToken.token.total_supply ?? "0",
				},
				rawTransaction: JSON.stringify(transaction),
			},
			{
				jobId,
				attempts: 3,
				backoff: {
					type: "exponential",
					delay: 2000,
				},
			}
		);

		// Return immediately with job information
		res.status(202).json({
			jobId: job.id,
			status: "queued",
			message: "Copy trade job elaboration has been queued",
		});
	} catch (error) {
		console.error("Error handling copy trade", error);
		res.status(500).json({
			status: "error",
			error: "Internal server error",
		});
	}
};

/**
 * Test copy trade controller for a specific group
 * @param req - The request object
 * @param res - The response object
 * @returns void
 */
export const handleTestWebhookGroupEvent = async (
	req: Request,
	res: Response
) => {
	try {
		const parseBody = testWebhookGroupTradeCreatedSchema.safeParse(req.body);
		if (!parseBody.success) {
			console.error("Invalid request body", parseBody.error.message);
			res.status(400).json({
				status: "error",
				error: "Invalid request",
			});
			return;
		}

		const webhookEvent = parseBody.data;

		const { groupId } = webhookEvent;
		const { trader, transaction } = webhookEvent.data;
		const jobId = ulid();
		if (!trader) {
			res.status(200).json({
				status: "success",
				message: "Trader is required to continue",
			});
			return;
		}

		// Add job to queue
		const chain = getChainByName(transaction.network.name);

		let receivingToken: FungibleBalance | undefined;
		let sendingToken: FungibleBalance | undefined;
		if (transaction.net_transfer) {
			if ("receiving_fungible" in transaction.net_transfer) {
				receivingToken = transaction.net_transfer.receiving_fungible;
			}
			if ("sending_fungible" in transaction.net_transfer) {
				sendingToken = transaction.net_transfer.sending_fungible;
			}
		} else {
			console.error(
				"[neynar-controller] No net transfer found in transaction",
				transaction
			);
			res.status(500).json({
				status: "failed",
				error: "No net transfer found in transaction",
			});
			return;
		}

		if (!(receivingToken && sendingToken)) {
			console.error(
				"[neynar-controller] No token found from neynar webhooktransaction",
				transaction
			);
			res.status(200).json({
				status: "failed",
				error: "No token found in transaction",
			});
			return;
		}

		// Normalize USD values across old/new webhook schemas
		const sellAmountUsdVal = sendingToken.balance.in_usd;
		const buyAmountUsdVal = receivingToken.balance.in_usd;

		const job = await neynarWebhookQueue.add(
			"process-neynar-webhook",
			{
				user: {
					fid: trader.fid,
				},
				groupId,
				transaction: {
					chainId: chain.id,
					transactionHash: transaction.hash as Hex,
					buyToken: getAddress(receivingToken.token.address),
					sellToken: getAddress(sendingToken.token.address),
					sellAmount: sendingToken.balance.in_token ?? "0",
					sellAmountUsd: sellAmountUsdVal?.toString() ?? "0",
					buyAmount: receivingToken.balance.in_token ?? "0",
					buyAmountUsd: buyAmountUsdVal?.toString() ?? "0",
					sellAmountTotSupply: sendingToken.token.total_supply ?? "0",
					buyAmountTotSupply: receivingToken.token.total_supply ?? "0",
				},
				rawTransaction: JSON.stringify(transaction),
			},
			{
				jobId,
				attempts: 3,
				backoff: {
					type: "exponential",
					delay: 2000,
				},
			}
		);

		// Return immediately with job information
		res.status(202).json({
			jobId: job.id,
			status: "queued",
			message: "Copy trade job elaboration has been queued",
		});
	} catch (error) {
		console.error("Error handling copy trade", error);
		res.status(500).json({
			status: "error",
			error: "Internal server error",
		});
	}
};

/**
 * Check the status of a neynar job
 */
export const checkJobStatus = async (req: Request, res: Response) => {
	try {
		const { jobId } = req.params;

		if (!jobId) {
			res.status(400).json({
				message: "Job ID is required",
			});
			return;
		}

		// Get job from queue
		const job = await neynarWebhookQueue.getJob(jobId);

		if (!job) {
			res.status(404).json({
				message: "Job not found",
				jobId,
			});
			return;
		}

		// Get job state
		const state = await job.getState();
		const progress = job.progress;

		// Build response based on job state
		let response: JobProgress | null = null;

		// Add additional info based on state
		const result = job.returnvalue as JobResult;
		if (state === "completed") {
			response = {
				status: state,
				progress: typeof progress === "number" ? progress : 0,
				result,
				createdAt: new Date(job.timestamp),
				updatedAt: new Date(job.timestamp),
			};
		} else if (state === "failed") {
			response = {
				status: state,
				progress: typeof progress === "number" ? progress : 0,
				error: job.failedReason,
				result,
				attemptsMade: job.attemptsMade,
				attemptsRemaining: (job.opts.attempts || 3) - job.attemptsMade,
				createdAt: new Date(job.timestamp),
				updatedAt: new Date(job.timestamp),
			};
		} else if (state === "delayed") {
			response = {
				status: state,
				progress: typeof progress === "number" ? progress : 0,
				delayReason: job.opts.delay ? "Scheduled delay" : "Retry backoff",
				processAt: new Date(
					job.processedOn || Date.now() + (job.opts.delay || 0)
				),
				createdAt: new Date(job.timestamp),
				updatedAt: new Date(job.timestamp),
			};
		} else if (state === "waiting") {
			const position = (await getJobPosition(job)) || 0;
			response = {
				status: state,
				progress: typeof progress === "number" ? progress : 0,
				position,
				createdAt: new Date(job.timestamp),
				updatedAt: new Date(job.timestamp),
			};
		} else if (state === "active") {
			response = {
				status: state,
				progress: typeof progress === "number" ? progress : 0,
				createdAt: new Date(job.timestamp),
				updatedAt: new Date(job.timestamp),
			};
		}

		res.json(response);
	} catch (error) {
		console.error("Error checking job status:", error);
		res.status(500).json({
			status: "error",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

/**
 * Get the position of a job in the queue
 */
async function getJobPosition(
	job: Job<NeynarWebhookJobData>
): Promise<number | null> {
	try {
		const waitingJobs = await neynarWebhookQueue.getWaitingCount();
		const jobs = await neynarWebhookQueue.getJobs(["waiting"], 0, waitingJobs);
		const position = jobs.findIndex((j) => j.id === job.id);
		return position >= 0 ? position + 1 : null;
	} catch {
		return null;
	}
}

/**
 * Cancel a neynar job
 */
export const cancelJob = async (req: Request, res: Response) => {
	try {
		const { jobId } = req.params;

		if (!jobId) {
			res.status(400).json({
				status: "error",
				error: "Job ID is required",
			});
			return;
		}

		const job = await neynarWebhookQueue.getJob(jobId);
		if (!job) {
			res.status(404).json({
				status: "error",
				error: "Job not found",
			});
			return;
		}

		const state = await job.getState();
		if (state === "completed") {
			res.status(400).json({
				status: "error",
				error: "Cannot cancel completed job",
			});
			return;
		}

		if (state === "failed") {
			res.status(400).json({
				status: "error",
				error: "Job has already failed",
			});
			return;
		}

		// Remove the job
		await job.remove();

		res.json({
			status: "success",
			message: "Job cancelled successfully",
		});
	} catch (error) {
		console.error("Error cancelling job:", error);
		res.status(500).json({
			status: "error",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};
