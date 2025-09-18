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
		dumpArray(lines, 'filters', v.filters);
		dumpArray(lines, 'sorts', v.sorts);
		dumpArray(lines, 'groups', v.groups);
	}
	// ensure trailing newline for cleaner diffs/tools
	return lines.join('\n') + '\n';
}

function escapeScalar(s: string): string {
	// Minimal YAML scalar escaping: quote only if contains problematic characters
	if (/^[A-Za-z0-9_ .-]+$/.test(s)) return s;
	// fallback to double-quoted and escape quotes
	return '"' + s.replace(/"/g, '\\"') + '"';
}

function dumpArray(lines: string[], name: string, arr?: Record<string, unknown>[]) {
	if (!arr || arr.length === 0) {
		lines.push(`    ${name}: []`);
		return;
	}
	lines.push(`    ${name}:`);
	for (const item of arr) {
		lines.push(`      -`);
		// deterministic key order → stable YAML diffs
		const keys = Object.keys(item).sort();
		for (const k of keys) {
			const v = (item as any)[k];
			let scalar: string;
			if (typeof v === 'string') scalar = escapeScalar(v);
			else if (typeof v === 'number' || typeof v === 'boolean') scalar = String(v);
			else if (v == null) scalar = '""';
			else {
				// keep nested objects simple as JSON for now; future: emit nested YAML
				scalar = escapeScalar(JSON.stringify(v));
			}
			lines.push(`        ${k}: ${scalar}`);
		}
	}
}
