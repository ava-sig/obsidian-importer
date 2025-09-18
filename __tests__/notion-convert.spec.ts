// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
import { describe, it, expect } from 'vitest';
import { convertBlocksToMarkdown } from '../src/formats/notion-convert';

const rt = (txt: string, opts: Partial<{
	bold: boolean; italic: boolean; strike: boolean; underline: boolean; code: boolean; href: string | null;
}> = {}) => ({
	plain_text: txt,
	href: opts.href ?? null,
	annotations: {
		bold: !!opts.bold,
		italic: !!opts.italic,
		strikethrough: !!opts.strike,
		underline: !!opts.underline,
		code: !!opts.code,
	},
	type: 'text' as const,
	text: { content: txt, link: opts.href ? { url: opts.href } : null }
});

describe('notion-convert (phase 1)', () => {
	it('paragraph → md', () => {
		const md = convertBlocksToMarkdown([
			{ id: '1', type: 'paragraph', paragraph: { rich_text: [rt('Hello '), rt('World', { bold: true })] } },
		] as any);
		expect(md).toBe('Hello \\*\\*World\\*\\*');
	});

	it('headings 1–3', () => {
		const md = convertBlocksToMarkdown([
			{ id: 'h1', type: 'heading_1', heading_1: { rich_text: [rt('Top')] } },
			{ id: 'h2', type: 'heading_2', heading_2: { rich_text: [rt('Mid')] } },
			{ id: 'h3', type: 'heading_3', heading_3: { rich_text: [rt('Low')] } },
		] as any);
		expect(md).toBe('# Top\n\n## Mid\n\n### Low');
	});

	it('bulleted list groups contiguous items', () => {
		const md = convertBlocksToMarkdown([
			{ id: 'b1', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [rt('a')] } },
			{ id: 'b2', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [rt('b')] } },
			{ id: 'p',  type: 'paragraph', paragraph: { rich_text: [rt('after')] } },
		] as any);
		expect(md).toBe('- a\n- b\n\nafter');
	});

	it('numbered list increments and resets', () => {
		const md = convertBlocksToMarkdown([
			{ id: 'n1', type: 'numbered_list_item', numbered_list_item: { rich_text: [rt('one')] } },
			{ id: 'n2', type: 'numbered_list_item', numbered_list_item: { rich_text: [rt('two')] } },
			{ id: 'p',  type: 'paragraph', paragraph: { rich_text: [rt('after')] } },
			{ id: 'n3', type: 'numbered_list_item', numbered_list_item: { rich_text: [rt('one again')] } },
		] as any);
		expect(md).toBe('1. one\n2. two\n\nafter\n\n1. one again');
	});

	it('to-do unchecked/checked', () => {
		const md = convertBlocksToMarkdown([
			{ id: 't1', type: 'to_do', to_do: { checked: false, rich_text: [rt('open')] } },
			{ id: 't2', type: 'to_do', to_do: { checked: true,  rich_text: [rt('done')] } },
		] as any);
		expect(md).toBe('- [ ] open\n\n- [x] done');
	});

	it('inline annotations stack and link applies last', () => {
		const md = convertBlocksToMarkdown([
			{ id: 'p', type: 'paragraph', paragraph: { rich_text: [rt('mix', { bold: true, italic: true, href: 'https://x.com' })] } },
		] as any);
		// bold+italic → **\*mix\*** then link → [**\*mix\***](https://x.com) with escapes applied
		expect(md).toBe('[\\*\\*\\*mix\\*\\*\\*](https://x.com)');
	});

	it('gracefully handles empty rich_text', () => {
		const md = convertBlocksToMarkdown([
			{ id: 'p', type: 'paragraph', paragraph: { rich_text: [] } },
			{ id: 'b', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [] } },
		] as any);
		expect(md).toBe('\n- ');
	});
});
