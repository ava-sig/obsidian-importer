// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Builds .base YAML structures for views/filters/sorts/groups/formulas (scaffold)
import type { NotionBaseView, NotionBaseConfig } from './notion-types';

export function buildBaseYaml(_config: NotionBaseConfig, _views: NotionBaseView[]): string {
	// TODO: emit YAML that Obsidian importer can read as a .base file
	return '# base: TODO\n';
}
