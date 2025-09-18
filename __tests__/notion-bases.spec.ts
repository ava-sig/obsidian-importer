// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
import { describe, it, expect } from 'vitest';
import { buildBaseYaml } from '../src/formats/notion-bases';

describe('Notion Bases', () => {
	it('emits minimal base YAML with a single view', () => {
		const yaml = buildBaseYaml(
			{ id: 'ds123', name: 'Demo Base' },
			[
				{ id: 'v1', name: 'All', type: 'table' },
			]
		);
		expect(yaml.trim()).toBe(
			[
				'base:',
				'  id: ds123',
				'  name: Demo Base',
				'views:',
				'  - id: v1',
				'    name: All',
				'    type: table',
				'    filters: []',
				'    sorts: []',
				'    groups: []',
			].join('\n')
		);
	});

	it('emits multiple views and preserves order', () => {
		const yaml = buildBaseYaml(
			{ id: 'dsX', name: 'Ordered' },
			[
				{ id: 'a', name: 'First', type: 'list' },
				{ id: 'b', name: 'Second', type: 'board' },
			]
		);
		expect(yaml.trim()).toBe(
			[
				'base:',
				'  id: dsX',
				'  name: Ordered',
				'views:',
				'  - id: a',
				'    name: First',
				'    type: list',
				'    filters: []',
				'    sorts: []',
				'    groups: []',
				'  - id: b',
				'    name: Second',
				'    type: board',
				'    filters: []',
				'    sorts: []',
				'    groups: []',
			].join('\n')
		);
	});
});
