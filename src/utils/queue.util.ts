import { addUsersQueue } from "../server/bullmq/queues/add-users.queue.js";

/**
 * Add users to the queue
 * @param users - The users to add to the queue
 * @returns
 */
export const addUsersToQueue = async (
	users: { fid: number; userId: string; groupId?: string }[],
) => {
	const job = await addUsersQueue.add(
		"process-add-users",
		{
			users,
		},
		{
			attempts: 3,
			backoff: {
				type: "exponential",
				delay: 2000,
			},
		},
	);
	return job;
};
