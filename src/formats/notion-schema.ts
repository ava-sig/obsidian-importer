// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Maps Data Source property schema → front matter fields (scaffold)
import type { NotionDataSourceSchema, FrontMatter } from './notion-types';

export function mapSchemaToFrontMatter(schema: NotionDataSourceSchema): FrontMatter {
	const out: FrontMatter = {};
	const props = schema.properties || {};
	for (const key of Object.keys(props)) {
		const { type, name } = props[key] as { type: string, name: string };
		const label = name || key;
		switch (type) {
			case 'title':
			case 'rich_text':
			case 'email':
			case 'phone_number':
			case 'created_by':
			case 'last_edited_by':
			case 'formula':
			case 'rollup':
			case 'unique_id':
			case 'status':
			case 'select':
			case 'url':
			case 'date':
				out[label] = defaultFor(type);
				break;
			case 'relation':
			case 'people':
			case 'files':
				out[label] = [];
				break;
			case 'multi_select':
				out[label] = [];
				break;
			case 'number':
				out[label] = 0;
				break;
			case 'checkbox':
				out[label] = false;
				break;
			default:
				out[label] = '';
				break;
		}
	}
	return out;
}

function defaultFor(type: string): unknown {
	switch (type) {
		case 'date':
			return '';
		case 'url':
			return '';
		case 'select':
		case 'status':
		case 'title':
		case 'rich_text':
		case 'email':
		case 'phone_number':
		case 'relation':
		case 'people':
		case 'files':
		case 'created_by':
		case 'last_edited_by':
		case 'formula':
		case 'rollup':
		case 'unique_id':
			return '';
		default:
			return '';
	}
}
