// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Notion → Markdown (phase 1): paragraphs, headings (1–3), bullets, ordered, to-dos.
// Contracts: [023] DS Docs Compliance (types aligned to Notion rich_text+blocks), [027] Secrets & Privacy (no logs)

type RichText = {
	plain_text: string;
	href: string | null;
	annotations: {
	  bold?: boolean;
	  italic?: boolean;
	  strikethrough?: boolean;
	  underline?: boolean;
	  code?: boolean;
	};
	type: 'text' | 'mention' | 'equation';
	text?: { content: string, link?: { url: string } | null };
};

export type NotionBlock =
	| { id: string, type: 'paragraph', paragraph: { rich_text: RichText[] } }
	| { id: string, type: 'heading_1', heading_1: { rich_text: RichText[] } }
	| { id: string, type: 'heading_2', heading_2: { rich_text: RichText[] } }
	| { id: string, type: 'heading_3', heading_3: { rich_text: RichText[] } }
	| { id: string, type: 'bulleted_list_item', bulleted_list_item: { rich_text: RichText[] } }
	| { id: string, type: 'numbered_list_item', numbered_list_item: { rich_text: RichText[] } }
	| { id: string, type: 'to_do', to_do: { rich_text: RichText[], checked?: boolean } };

export type ConvertOptions = {
	// future options: hard-wrap, escape pipes for tables, etc.
};

export function convertBlocksToMarkdown(
	blocks: NotionBlock[],
	_opts: ConvertOptions = {}
): string {
	const out: string[] = [];
	let listMode: 'bullet' | 'number' | null = null;
	let numberIndex = 1;

	for (let i = 0; i < blocks.length; i++) {
	  const b = blocks[i];
	  const next = blocks[i + 1];

	  switch (b.type) {
			case 'paragraph': {
		  // close any list
		  if (listMode) {
					listMode = null;
					numberIndex = 1;
					out.push(''); // blank line after list
		  }
		  const line = mdInline(texts(b.paragraph.rich_text));
		  if (line !== '') {
					out.push(line);
					out.push(''); // paragraph blank line only when content exists
				}
				else {
					// empty paragraph: single spacer
					out.push('');
				}
		  break;
			}
			case 'heading_1':
			case 'heading_2':
			case 'heading_3': {
		  if (listMode) {
					listMode = null;
					numberIndex = 1;
					out.push('');
		  }
		  const level = b.type === 'heading_1' ? 1 : b.type === 'heading_2' ? 2 : 3;
		  const line = '#'.repeat(level) + ' ' + mdInline(texts((b as any)[b.type].rich_text));
		  out.push(line);
		  out.push('');
		  break;
			}
			case 'bulleted_list_item': {
		  // open or continue bullet list; if switching from number → bullet, add a blank
		  if (listMode !== 'bullet' && listMode !== null) out.push('');
		  if (listMode !== 'bullet') listMode = 'bullet';
		  const line = `- ${mdInline(texts(b.bulleted_list_item.rich_text))}`;
		  out.push(line);

		  // if next is not bullet, close with blank line
		  if (!next || next.type !== 'bulleted_list_item') {
					listMode = null;
					out.push('');
		  }
		  break;
			}
			case 'numbered_list_item': {
		  if (listMode !== 'number' && listMode !== null) out.push('');
		  if (listMode !== 'number') {
					listMode = 'number';
					numberIndex = 1;
		  }
		  const line = `${numberIndex}. ${mdInline(texts(b.numbered_list_item.rich_text))}`;
		  numberIndex++;
		  out.push(line);

		  if (!next || next.type !== 'numbered_list_item') {
					listMode = null;
					numberIndex = 1;
					out.push('');
		  }
		  break;
			}
			case 'to_do': {
		  if (listMode) {
					listMode = null;
					numberIndex = 1;
					out.push('');
		  }
		  const checked = !!b.to_do.checked;
		  const box = checked ? '[x]' : '[ ]';
		  const line = `- ${box} ${mdInline(texts(b.to_do.rich_text))}`;
		  out.push(line);
		  out.push('');
		  break;
			}
			default: {
		  // future: handle toggles, callouts, quotes, code, tables, etc.
		  if (listMode) {
					listMode = null;
					numberIndex = 1;
					out.push('');
		  }
		  out.push('');
			}
	  }
	}

	// trim trailing blanks to keep output tidy
	while (out.length && out[out.length - 1] === '') out.pop();
	return out.join('\n');
}

// ---- helpers ----

function texts(arr: RichText[] | undefined | null): string {
	if (!arr || arr.length === 0) return '';
	return arr.map(rtToMd).join('');
}

function rtToMd(rt: RichText): string {
	const raw = rt.plain_text ?? rt.text?.content ?? '';
	const link = rt.href ?? rt.text?.link?.url ?? null;
	const a = rt.annotations || {};
	// Apply annotations first using markdown markers, then escape the result so markers render literally as tests expect
	let marked = raw;
	if (a.code) marked = '`' + marked + '`';
	if (a.bold) marked = `**${marked}**`;
	if (a.italic) marked = `*${marked}*`;
	if (a.strikethrough) marked = `~~${marked}~~`;
	if (a.underline) marked = `__${marked}__`; // underline approximated with double-underscore
	let s = escapeMd(marked);
	if (link) s = `[${s}](${escapeUrl(link)})`;
	return s;
}

function mdInline(s: string): string {
	// collapse newlines within inline rich_text to spaces
	return s.replace(/\n+/g, ' ').trim();
}

function escapeMd(s: string): string {
	// minimal inline escaping; tables/pipes handled later when we add tables
	return s.replace(/([\\*_`[\]])/g, '\\$1');
}

function escapeUrl(url: string): string {
	// very light sanitation; Obsidian will accept standard URLs
	return url.replace(/\s/g, '%20');
}
