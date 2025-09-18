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
		try {
			const props = (schema as any)?.properties ?? {};
			const titleKey = Object.keys(props).find(k => (props as any)[k]?.type === 'title');
			if (!titleKey) return null;
			const pv: any = (page as any)?.properties?.[titleKey];
			const arr: any[] = pv?.title ?? pv?.rich_text ?? [];
			if (!Array.isArray(arr) || arr.length === 0) return null;
			const first = arr.find((x: any) => ((x?.plain_text ?? x?.text?.content ?? '').trim().length > 0)) ?? arr[0];
			const s = (first?.plain_text ?? first?.text?.content ?? '').trim()
				|| arr.map((x: any) => (x?.plain_text ?? x?.text?.content ?? '')).join('').trim();
			return s || null;
		}
		catch {
			return null;
		}
	}

	private toYaml(obj: Record<string, unknown>): string {
		const keys = Object.keys(obj).sort();
		const lines: string[] = [];
		for (const k of keys) {
			lines.push(`${k}: ${this.yamlScalar((obj as any)[k])}`);
		}
		return lines.join('\n') + '\n';
	}

	private yamlScalar(v: unknown): string {
		if (v === null || v === undefined) return '""';
		if (Array.isArray(v)) return v.length ? `[${v.map(x => this.yamlScalar(x)).join(', ')}]` : '[]';
		switch (typeof v) {
			case 'number':
			case 'boolean': return String(v);
			default: {
				const s = String(v);
				return /^[A-Za-z0-9 _.-]+$/.test(s) ? s : `"${s.replace(/\"/g, '"').replace(/"/g, '\\"')}"`;
			}
		}
	}

	private safeFilename(name: string): string {
		let s = String(name || '').trim() || 'untitled';
		s = s.replace(/[<>:\"/\\|?*\u0000-\u001F]/g, '-');
		s = s.replace(/\s+/g, ' ');
		s = s.replace(/\.{2,}/g, '.');
		s = s.replace(/[. ]+$/g, '');
		if (!s) s = 'untitled';
		return s.length > 120 ? s.slice(0, 120).trim() : s;
	}

}
