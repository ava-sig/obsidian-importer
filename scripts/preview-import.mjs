#!/usr/bin/env node
// [SIG-FLD-VAL-001] Declared in posture, amplified in field.

import { promises as fs } from 'fs';
import path from 'path';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DS_ID = process.env.NOTION_DS_ID;
const OUT_DIR = process.env.OUT_DIR || '/tmp/notion-preview';

if (!NOTION_TOKEN || !NOTION_DS_ID) {
	console.error('Error: NOTION_TOKEN and NOTION_DS_ID environment variables are required');
	process.exit(1);
}

async function main() {
	try {
		// Ensure output directory exists
		await fs.mkdir(OUT_DIR, { recursive: true });

		// Dynamic imports for compiled ES modules (built to dist/)
		const { NotionClient } = await import('../src/network/notionClient.ts');
		const { NotionApiImporter } = await import('../src/formats/notion-api.ts');

		const client = new NotionClient({ token: NOTION_TOKEN });
		const writeFile = async (filePath, content) => {
			const fullPath = path.join(OUT_DIR, filePath);
			const dir = path.dirname(fullPath);
			await fs.mkdir(dir, { recursive: true });
			await fs.writeFile(fullPath, content, 'utf8');
		};

		const importer = new NotionApiImporter({
			client,
			folder: 'Notion',
			writeFile,
		});

		console.log(`Starting Notion import from Data Source: ${NOTION_DS_ID}`);
		console.log(`Output directory: ${OUT_DIR}`);

		await importer.run(NOTION_DS_ID);

		console.log('Import completed successfully!');
		console.log(`Check ${OUT_DIR} for imported files`);
	} catch (error) {
		console.error('Import failed:', error.message);
		process.exit(1);
	}
}

main();
