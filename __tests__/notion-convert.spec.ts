// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
import { describe, it, expect } from 'vitest';
import { convertBlockToMarkdown } from '../src/formats/notion-convert';

describe.skip('Notion Convert', () => {
	it('converts basic paragraph (to be implemented)', () => {
		expect(typeof convertBlockToMarkdown).toBe('function');
	});
});
