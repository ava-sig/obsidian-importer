// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Helper utilities for Notion importer

export function sanitizeId(id: string): string {
	return id.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

export function safeFilename(name: string): string {
	return name.trim().replace(/[\\/:*?"<>|]+/g, '-');
}

export function formatDate(d: Date): string {
	// ISO without milliseconds for nicer filenames
	return d.toISOString().replace(/\..+Z$/, 'Z');
}
