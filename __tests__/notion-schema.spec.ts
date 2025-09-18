// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
import { describe, it, expect } from 'vitest';
import { mapSchemaToFrontMatter } from '../src/formats/notion-schema';
import type { NotionDataSourceSchema } from '../src/formats/notion-types';

describe('notion-schema → front matter mapping', () => {
	it('maps common property types to sensible defaults', () => {
		const schema: NotionDataSourceSchema = {
			id: 'ds123',
			properties: {
				titleProp: { type: 'title', name: 'Title' },
				desc: { type: 'rich_text', name: 'Description' },
				score: { type: 'number', name: 'Score' },
				status: { type: 'select', name: 'Status' },
				tags: { type: 'multi_select', name: 'Tags' },
				due: { type: 'date', name: 'Due' },
				done: { type: 'checkbox', name: 'Done' },
				url: { type: 'url', name: 'URL' },
			},
		};

		const fm = mapSchemaToFrontMatter(schema);
		expect(fm).toEqual({
			Title: '',
			Description: '',
			Score: 0,
			Status: '',
			Tags: [],
			Due: '',
			Done: false,
			URL: '',
		});
	});
});
