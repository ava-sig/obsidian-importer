// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Notion API importer scaffold: registers an importer with Obsidian runtime (to be wired by host app)

export interface FormatImporter {
	id: string;
	label: string;
	// Initialize with configuration or secrets if needed
	init?(): Promise<void> | void;
	// Perform an import run for a given source identifier
	run(sourceId: string): Promise<void>;
}

export class NotionApiImporter implements FormatImporter {
	id = 'notion-api';
	label = 'Notion (Data Sources)';

	async init(): Promise<void> {
		// no-op for now
	}

	async run(_sourceId: string): Promise<void> {
		// TODO: wire NotionClient + conversion pipeline here
		return;
	}
}

// Factory function for host code to create/register the importer
export function createNotionApiImporter(): NotionApiImporter {
	return new NotionApiImporter();
}
