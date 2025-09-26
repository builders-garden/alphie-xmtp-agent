export interface GroupUpdatedMessage {
	conversationId: string;
	contentType: { typeId: "group_updated" };
	content: {
		metadataFieldChanges?: Array<{
			fieldName: string; // "group_name", "group_description", etc.
			oldValue: string;
			newValue: string;
		}>;
		addedInboxes?: Array<{
			inboxId: string; // New members added
		}>;
		removedInboxes?: Array<{
			inboxId: string; // Members removed
		}>;
		initiatedByInboxId?: string; // Who triggered the update
	};
}
