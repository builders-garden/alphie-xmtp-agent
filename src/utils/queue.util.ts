import { updateUsersQueue } from "../server/bullmq/queues/update-users.queue.js";
import type { QueueUser } from "../types/queue.type.js";

/**
 * Add users to the queue
 * @param users - The users to add to the queue
 * @returns
 */
export const updateUsersToQueue = async ({
	addUsers,
	removeUsers,
}: {
	addUsers?: QueueUser[];
	removeUsers?: QueueUser[];
}) => {
	const job = await updateUsersQueue.add(
		"process-update-users",
		{
			addUsers: addUsers ?? [],
			removeUsers: removeUsers ?? [],
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
