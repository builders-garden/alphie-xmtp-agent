import type { Job } from "bullmq";
import type { Request, Response } from "express";
import type {
	JobProgress,
	JobResult,
	UpdateUsersJobData,
} from "../../types/index.js";
import { updateUsersJobDataSchema } from "../../types/queue.type.js";
import { updateUsersToQueue } from "../../utils/queue.util.js";
import { updateUsersQueue } from "../bullmq/queues/update-users.queue.js";

/**
 * Handle update trackings controller
 * @param req - The request object
 * @param res - The response object
 * @returns void
 */
export const handleUpdateTrackings = async (req: Request, res: Response) => {
	try {
		const parseBody = updateUsersJobDataSchema.safeParse(req.body);
		if (!parseBody.success) {
			console.error("Invalid request body", parseBody.error.message);
			res.status(400).json({
				status: "nok",
				error: "Invalid request",
			});
			return;
		}

		const { addUsers, removeUsers } = parseBody.data;

		if (addUsers.length === 0 && removeUsers.length === 0) {
			console.warn("No users to add nor to remove");
			res.status(400).json({
				status: "nok",
				message: "No users to add nor to remove",
			});
			return;
		}

		const job = await updateUsersToQueue({ addUsers, removeUsers });

		// Return immediately with job information
		res.status(202).json({
			jobId: job.id,
			status: "ok",
			message: "Update trackings job has been queued",
		});
	} catch (error) {
		console.error("Error handling update trackings", error);
		res.status(500).json({
			status: "nok",
			error: "Internal server error",
		});
	}
};

/**
 * Check the status of a update trackings job
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
		const job = await updateUsersQueue.getJob(jobId);

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
					job.processedOn || Date.now() + (job.opts.delay || 0),
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
		console.error("Error checking update trackings status:", error);
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
	job: Job<UpdateUsersJobData>,
): Promise<number | null> {
	try {
		const waitingJobs = await updateUsersQueue.getWaitingCount();
		const jobs = await updateUsersQueue.getJobs(["waiting"], 0, waitingJobs);
		const position = jobs.findIndex((j) => j.id === job.id);
		return position >= 0 ? position + 1 : null;
	} catch {
		return null;
	}
}

/**
 * Cancel a update trackings job
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

		const job = await updateUsersQueue.getJob(jobId);
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
