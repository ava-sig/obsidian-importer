// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotionClient } from '../../src/network/notionClient';

// Minimal Headers/Response shims to avoid DOM/undici dependency
class MockHeaders {
	private map: Record<string, string>;
	constructor(init: Record<string, string> = {}) {
		this.map = {};
		for (const k of Object.keys(init)) this.map[k.toLowerCase()] = init[k];
	}
	get(name: string): string | null {
		return this.map[name.toLowerCase()] ?? null;
	}
}

class MockResponse {
	status: number;
	headers: MockHeaders;
	private _body: string;
	constructor(body: string, init: { status: number, headers?: Record<string, string> }) {
		this._body = body;
		this.status = init.status;
		this.headers = new MockHeaders(init.headers ?? {});
	}
	async text() {
		return this._body; 
	}
	async json() {
		return JSON.parse(this._body || 'null'); 
	}
}

describe('NotionClient', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('sets Notion-Version header to 2025-09-03', async () => {
		const spy = vi.spyOn(globalThis as any, 'fetch').mockImplementation(async (_input: any, init?: any) => {
			const headers = (init?.headers || {}) as Record<string, string>;
			expect(headers['Notion-Version']).toBe('2025-09-03');
			const body = JSON.stringify({ ok: true });
			return new MockResponse(body, { status: 200, headers: { 'content-type': 'application/json' } }) as any;
		});

		const client = new NotionClient();
		const res = await client.request<{ ok: boolean }>({ path: '/v1/data_sources/query', method: 'POST', body: {} });
		expect(res.ok).toBe(true);
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('includes Authorization header when token is set', async () => {
		const token = 'test-token';
		const spy = vi.spyOn(globalThis as any, 'fetch').mockImplementation(async (_: any, init?: any) => {
			const headers = (init?.headers || {}) as Record<string, string>;
			expect(headers['Authorization']).toBe(`Bearer ${token}`);
			const body = JSON.stringify({ ok: true });
			return new MockResponse(body, { status: 200, headers: { 'content-type': 'application/json' } }) as any;
		});

		const client = new NotionClient({ token });
		const res = await client.request<{ ok: boolean }>({ path: '/v1/data_sources/query', method: 'POST', body: {} });
		expect(res.ok).toBe(true);
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('blocks legacy databases endpoints by default', async () => {
		vi.spyOn(globalThis as any, 'fetch').mockImplementation(async () => {
			throw new Error('fetch should not be called for blocked endpoints');
		});

		const client = new NotionClient();
		await expect(
			client.request({ path: '/v1/databases/query', method: 'POST', body: {} })
		).rejects.toThrow(/\[SIG-SYS-NOT-023]/);
	});

	it('allows legacy endpoints when allowLegacy is true and downgradeNote is provided', async () => {
		const spy = vi.spyOn(globalThis as any, 'fetch').mockImplementation(async () => {
			const body = JSON.stringify({ ok: true });
			return new MockResponse(body, { status: 200, headers: { 'content-type': 'application/json' } }) as any;
		});

		const client = new NotionClient({ allowLegacy: true, downgradeNote: 'Temporary fallback' });
		const res = await client.request<{ ok: boolean }>({ path: '/v1/databases/query', method: 'POST', body: {} });
		expect(res.ok).toBe(true);
		expect(spy).toHaveBeenCalledTimes(1);
	});
});
