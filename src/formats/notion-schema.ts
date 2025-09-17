// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Maps Data Source property schema → front matter fields (scaffold)
import type { NotionDataSourceSchema, FrontMatter } from './notion-types';

export function mapSchemaToFrontMatter(_schema: NotionDataSourceSchema): FrontMatter {
	// TODO: translate Notion property types (title, rich_text, number, select, multi_select, date, relation, formula …)
	return {};
}
