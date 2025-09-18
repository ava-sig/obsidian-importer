// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotionApiImporter } from '../src/formats/notion-api';

describe('NotionApiImporter.run()', () => {
	let mockClient: any;
	let mockWriteFile: any;
	let importer: NotionApiImporter;
	let writtenFiles: Array<{ path: string, content: string }>;

	beforeEach(() => {
		writtenFiles = [];
		
		mockClient = {
			request: vi.fn()
		};

		mockWriteFile = vi.fn(async (path: string, content: string) => {
			writtenFiles.push({ path, content });
		});

		importer = new NotionApiImporter({
			client: mockClient,
			folder: 'TestFolder',
			writeFile: mockWriteFile,
		});
	});

	it('should run full pipeline with schema, query, blocks, and file writing', async () => {
		// Mock schema response
		const mockSchema = {
			properties: {
				title: { type: 'title' },
				status: { type: 'select' }
			}
		};

		// Mock query response with pagination
		const mockQueryResp1 = {
			results: [
				{ id: 'page1', properties: { title: { title: [{ plain_text: 'Test Page 1' }] } } },
				{ id: 'page2', properties: { title: { title: [{ plain_text: 'Test Page 2' }] } } }
			],
			next_cursor: 'cursor123'
		};

		const mockQueryResp2 = {
			results: [
				{ id: 'page3', properties: { title: { title: [{ plain_text: 'Test Page 3' }] } } }
			],
			next_cursor: null
		};

		// Mock blocks responses
		const mockBlocksResp1 = {
			results: [
				{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Content for page 1' }] } }
			],
			next_cursor: null
		};

		const mockBlocksResp2 = {
			results: [
				{ type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Heading' }] } },
				{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Content for page 2' }] } }
			],
			next_cursor: null
		};

		const mockBlocksResp3 = {
			results: [
				{ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'List item' }] } }
			],
			next_cursor: null
		};

		// Setup mock responses
		mockClient.request
			.mockResolvedValueOnce(mockSchema) // Schema call
			.mockResolvedValueOnce(mockQueryResp1) // First query call
			.mockResolvedValueOnce(mockBlocksResp1) // Blocks for page1
			.mockResolvedValueOnce(mockBlocksResp2) // Blocks for page2
			.mockResolvedValueOnce(mockQueryResp2) // Second query call (pagination)
			.mockResolvedValueOnce(mockBlocksResp3); // Blocks for page3

		await importer.run('test-ds-id');

		// Verify API calls
		expect(mockClient.request).toHaveBeenCalledTimes(6);
		
		// Schema call
		expect(mockClient.request).toHaveBeenNthCalledWith(1, {
			path: '/v1/data_sources/test-ds-id',
			method: 'GET'
		});

		// First query call
		expect(mockClient.request).toHaveBeenNthCalledWith(2, {
			path: '/v1/data_sources/test-ds-id/query',
			method: 'POST',
			body: {}
		});

		// Second query call with cursor
		expect(mockClient.request).toHaveBeenNthCalledWith(5, {
			path: '/v1/data_sources/test-ds-id/query',
			method: 'POST',
			body: { start_cursor: 'cursor123' }
		});

		// Blocks calls with query parameters (not body)
		expect(mockClient.request).toHaveBeenNthCalledWith(3, {
			path: '/v1/blocks/page1/children',
			method: 'GET'
		});

		// Verify files written
		expect(mockWriteFile).toHaveBeenCalledTimes(3);
		expect(writtenFiles).toHaveLength(3);

		// Check first file
		const file1 = writtenFiles[0];
		expect(file1.path).toBe('TestFolder/Test Page 1.md');
		expect(file1.content).toContain('---\n');
		expect(file1.content).toContain('id: page1\n');
		expect(file1.content).toContain('title: Test Page 1\n');
		expect(file1.content).toContain('---\n\n');
		expect(file1.content).toContain('Content for page 1');

		// Check second file
		const file2 = writtenFiles[1];
		expect(file2.path).toBe('TestFolder/Test Page 2.md');
		expect(file2.content).toContain('title: Test Page 2\n');
		expect(file2.content).toContain('# Heading\n\nContent for page 2');

		// Check third file
		const file3 = writtenFiles[2];
		expect(file3.path).toBe('TestFolder/Test Page 3.md');
		expect(file3.content).toContain('title: Test Page 3\n');
		expect(file3.content).toContain('- List item');
	});

	it('should handle pagination in blocks fetching', async () => {
		const mockSchema = { properties: {} };
		const mockQueryResp = {
			results: [{ id: 'page1', properties: {} }],
			next_cursor: null
		};

		// Mock blocks with pagination
		const mockBlocksResp1 = {
			results: [
				{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'First block' }] } }
			],
			next_cursor: 'blocks_cursor_123'
		};

		const mockBlocksResp2 = {
			results: [
				{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Second block' }] } }
			],
			next_cursor: null
		};

		mockClient.request
			.mockResolvedValueOnce(mockSchema)
			.mockResolvedValueOnce(mockQueryResp)
			.mockResolvedValueOnce(mockBlocksResp1)
			.mockResolvedValueOnce(mockBlocksResp2);

		await importer.run('test-ds-id');

		// Verify blocks pagination uses query parameters
		expect(mockClient.request).toHaveBeenNthCalledWith(3, {
			path: '/v1/blocks/page1/children',
			method: 'GET'
		});

		expect(mockClient.request).toHaveBeenNthCalledWith(4, {
			path: '/v1/blocks/page1/children?start_cursor=blocks_cursor_123',
			method: 'GET'
		});

		// Verify both blocks are in the content
		const file = writtenFiles[0];
		expect(file.content).toContain('First block');
		expect(file.content).toContain('Second block');
	});

	it('should use page ID as filename fallback when title extraction fails', async () => {
		const mockSchema = { properties: {} };
		const mockQueryResp = {
			results: [{ id: 'page-without-title', properties: {} }],
			next_cursor: null
		};
		const mockBlocksResp = { results: [], next_cursor: null };

		mockClient.request
			.mockResolvedValueOnce(mockSchema)
			.mockResolvedValueOnce(mockQueryResp)
			.mockResolvedValueOnce(mockBlocksResp);

		await importer.run('test-ds-id');

		expect(writtenFiles[0].path).toBe('TestFolder/page-without-title.md');
		expect(writtenFiles[0].content).toContain('title: page-without-title\n');
	});
});
