// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Settings UI scaffold (host app must wire this into Obsidian settings)
export interface NotionSettings {
	token: string | null;
	attachmentFolder: string;
}

export function getDefaultSettings(): NotionSettings {
	return { token: null, attachmentFolder: 'Notion Attachments' };
}
