// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
import { NotionClient } from '../network/notionClient';

// Temporary inline types and functions until we create the separate files
type NotionBlock = any;
type NotionPage = any;
type NotionSchema = any;

function convertBlocksToMarkdown(blocks: NotionBlock[]): string {
	return blocks.map(block => {
		if (block.type === 'paragraph') {
			return block.paragraph?.rich_text?.[0]?.plain_text || '';
		}
		if (block.type === 'heading_1') {
			return `# ${block.heading_1?.rich_text?.[0]?.plain_text || ''}`;
		}
		if (block.type === 'bulleted_list_item') {
			return `- ${block.bulleted_list_item?.rich_text?.[0]?.plain_text || ''}`;
		}
		return '';
	}).filter(Boolean).join('\n\n');
}

function mapSchemaToFrontMatter(schema: NotionSchema): Record<string, unknown> {
	return {}; // Simple implementation for now
}

export interface NotionApiImporterOptions {
	client: NotionClient;
	folder?: string;
	writeFile: (path: string, content: string) => Promise<void>;
}

export class NotionApiImporter {
	private client: NotionClient;
	private folder: string;
	private writeFile: (path: string, content: string) => Promise<void>;

	constructor(options: NotionApiImporterOptions) {
		this.client = options.client;
		this.folder = options.folder || '';
		this.writeFile = options.writeFile;
	}

	async run(sourceId: string): Promise<void> {
		if (!sourceId) throw new Error('NotionApiImporter.run requires a Data Source ID');

		const schema = await this.client.request({ path: `/v1/data_sources/${sourceId}`, method: 'GET' }) as any;
		const fmDefaults = mapSchemaToFrontMatter(schema);

		let cursor: string | null | undefined = undefined;
		do {
			const body: Record<string, unknown> = {};
			if (cursor) body['start_cursor'] = cursor;
			const resp = await this.client.request({ path: `/v1/data_sources/${sourceId}/query`, method: 'POST', body }) as any;
			const pages = resp.results || [];

			for (const page of pages) {
				const pageId = page.id;
				const blocks = await this.fetchAllBlocks(pageId);
				const md = convertBlocksToMarkdown(blocks);

				const title = this.getPageTitle(page, schema) || pageId;
				const fm = { id: pageId, title, ...fmDefaults };
				const fmYaml = this.toYaml(fm);
				const content = `---\n${fmYaml}---\n\n${md}\n`;

				const safeName = this.safeFilename(title) + '.md';
				const rel = this.folder ? `${this.folder}/${safeName}` : safeName;
				await this.writeFile(rel, content);
			}

			cursor = resp.next_cursor;
		} while (cursor);
	}

	private async fetchAllBlocks(pageId: string): Promise<NotionBlock[]> {
		let all: NotionBlock[] = [];
		let cursor: string | null | undefined = undefined;
		do {
			let path: string = `/v1/blocks/${pageId}/children`;
			if (cursor) {
				const enc = encodeURIComponent(cursor);
				path = `/v1/blocks/${pageId}/children?start_cursor=${enc}`;
			}
			const resp = await this.client.request({ path: path as any, method: 'GET' }) as any;
			all = all.concat(resp.results || []);
			cursor = resp.next_cursor;
		} while (cursor);
		return all;
	}

	private getPageTitle(page: NotionPage, schema: NotionSchema): string | null {
		const titleProp = Object.entries(schema.properties || {}).find(
			([, prop]: [string, any]) => prop.type === 'title'
		);
		if (!titleProp) return null;

		const [titleKey] = titleProp;
		const titleValue = page.properties?.[titleKey];
		if (!titleValue?.title?.[0]?.plain_text) return null;

		return titleValue.title[0].plain_text;
	}

	private toYaml(obj: Record<string, unknown>): string {
		const keys = Object.keys(obj).sort();
		const lines = keys.map(key => {
			const value = obj[key];
			if (typeof value === 'string') {
				return `${key}: ${value}`;
			}
			return `${key}: ${JSON.stringify(value)}`;
		});
		return lines.join('\n') + '\n';
	}

	private safeFilename(name: string): string {
		const safe = name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
		return safe.length > 120 ? safe.slice(0, 120).trim() : safe;
	}

}
