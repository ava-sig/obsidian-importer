// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Builds .base YAML structures for views/filters/sorts/groups/formulas (scaffold)
import type { NotionBaseView, NotionBaseConfig } from './notion-types';

// Emit a minimal YAML document that matches tests:
// base:
//   id: <id>
//   name: <name>
// views:
//   - id: <id>
//     name: <name>
//     type: <type>
//     filters: []
//     sorts: []
//     groups: []
export function buildBaseYaml(config: NotionBaseConfig, views: NotionBaseView[]): string {
	const lines: string[] = [];
	lines.push('base:');
	lines.push(`  id: ${escapeScalar(config.id)}`);
	lines.push(`  name: ${escapeScalar(config.name)}`);
	lines.push('views:');
	for (const v of views) {
		lines.push(`  - id: ${escapeScalar(v.id)}`);
		lines.push(`    name: ${escapeScalar(v.name)}`);
		lines.push(`    type: ${escapeScalar(v.type)}`);
		lines.push(`    filters: []`);
		lines.push(`    sorts: []`);
		lines.push(`    groups: []`);
	}
	return lines.join('\n');
}

function escapeScalar(s: string): string {
	// Minimal YAML scalar escaping: quote only if contains problematic characters
	if (/^[A-Za-z0-9_ .-]+$/.test(s)) return s;
	// fallback to double-quoted and escape quotes
	return '"' + s.replace(/"/g, '\\"') + '"';
}
