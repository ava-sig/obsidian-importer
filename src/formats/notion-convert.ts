// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Notion blocks → Markdown conversion (scaffold)
import type { NotionBlock, NotionPage } from './notion-types';

export type Markdown = string;

export function convertBlockToMarkdown(_block: NotionBlock): Markdown {
	// TODO: implement paragraphs, bulleted lists, numbered lists, to-dos, tables, equations, embeds …
	return '';
}

export function convertPageToMarkdown(_page: NotionPage, _children: NotionBlock[]): Markdown {
	// TODO: stitch child blocks into a single Markdown document with front matter
	return '';
}
