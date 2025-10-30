import type { MessageContext } from "@xmtp/agent-sdk";
import {
	type Action,
	type ActionsContent,
	ContentTypeActions,
} from "../../types/index.js";

/**
 * Action builder for XMTP inline actions
 * @param id - The id of the action
 * @param description - The description of the action
 * @returns The action builder
 */
export class ActionBuilder {
	private actions: Action[] = [];
	private actionId = "";
	private actionDescription = "";

	static create(id: string, description: string): ActionBuilder {
		const builder = new ActionBuilder();
		builder.actionId = id;
		builder.actionDescription = description;
		return builder;
	}

	add({
		id,
		label,
		style,
		metadata,
	}: {
		id: string;
		label: string;
		style?: "primary" | "secondary" | "danger";
		metadata?: Record<string, unknown>;
	}): this {
		this.actions.push({ id, label, style, metadata });
		return this;
	}

	build(): ActionsContent {
		return {
			id: this.actionId,
			description: this.actionDescription,
			actions: this.actions,
		};
	}

	async send(ctx: MessageContext): Promise<void> {
		await ctx.conversation.send(this.build(), ContentTypeActions);
	}
}
