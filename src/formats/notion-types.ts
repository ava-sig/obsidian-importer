// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Minimal Notion types for compilation; extend as needed

export type FrontMatter = Record<string, unknown>;

export interface NotionDataSourceSchema {
	id: string;
	properties: Record<string, { type: string, name: string }>;
}

export interface NotionPage {
	id: string;
	title?: string;
	properties?: Record<string, unknown>;
}

export interface NotionBlock {
	id: string;
	type: string;
	has_children?: boolean;
	[key: string]: any; // placeholder for block-specific fields
}

export interface NotionBaseView {
	id: string;
	name: string;
	type: 'table' | 'board' | 'list' | 'calendar' | 'gallery';
}

export interface NotionBaseConfig {
	id: string;
	name: string;
}
