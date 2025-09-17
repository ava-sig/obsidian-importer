// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
// Notion Data Sources client — enforces Notion-Version and governance constraints.
// Contracts: [027] Secrets & Privacy, [018] Rate Limit & Retry, [023] DS Docs Compliance, [032] Back-Compat
/* eslint-disable indent, no-mixed-spaces-and-tabs, brace-style */

export type NotionClientOptions = {
	baseUrl?: string;
	token?: string | null; // keep in memory by default; do not persist by default
	allowLegacy?: boolean;
	downgradeNote?: string;
	timeoutMs?: number; // default 30000
	maxRedirects?: number; // default 0
	maxRetries?: number; // default 3 (for 429/5xx)
};

export type NotionRequest = {
	path:
	  | `/v1/data_sources/${string}`
	  | `/v1/data_sources/${string}/query`
	  | `/v1/blocks/${string}`
	  | `/v1/blocks/${string}/children`
	  | `/v1/pages/${string}`
	  | '/v1/comments'
	  | `/v1/comments/${string}`
	  | `/v1/databases/${string}`; // only if allowLegacy=true
	method?: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE';
	headers?: Record<string, string>;
	body?: unknown;
};

const NOTION_VERSION = '2025-09-03' as const;

export class NotionClient {
	private baseUrl: string;
	private token: string | null;
	private allowLegacy: boolean;
	private downgradeNote?: string;
	private timeoutMs: number;
	private maxRedirects: number;
	private maxRetries: number;
	private _fetch?: typeof fetch;

	constructor(opts: NotionClientOptions = {}, injectedFetch?: typeof fetch) {
	  this.baseUrl = (opts.baseUrl ?? 'https://api.notion.com').replace(/\/+$/, '');
	  this.token = opts.token ?? null;
	  this.allowLegacy = !!opts.allowLegacy;
	  this.downgradeNote = opts.downgradeNote;
	  this.timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 30_000;
	  this.maxRedirects = typeof opts.maxRedirects === 'number' ? opts.maxRedirects : 0;
	  const mr = typeof opts.maxRetries === 'number' ? opts.maxRetries : 3;
	  this.maxRetries = Math.min(mr, 5);
	  this._fetch = injectedFetch;
	}

	setToken(token: string | null) {
	  this.token = token;
	}

	private f(): typeof fetch {
	  // @ts-ignore - fetch exists in Obsidian runtime
	  return this._fetch ?? fetch;
	}

	async request<T = unknown>(req: NotionRequest): Promise<T> {
	  this.ensureCompliantPath(req.path);

	  const url = this.baseUrl + req.path;
	  const hasBody = req.body != null && req.method !== 'GET' && req.method !== 'HEAD';
	  const method = (req.method ?? (hasBody ? 'POST' : 'GET')).toUpperCase() as NotionRequest['method'];
	  const headers: Record<string, string> = {
			'Notion-Version': NOTION_VERSION,
			'Accept': 'application/json',
			...req.headers,
	  };
	  if (hasBody && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
	  if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

	  const controller = new AbortController();
	  const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

	  const sameOrigin = (from: string, to: string) => {
			try {
		  const a = new URL(from);
		  const b = new URL(to);
		  return a.origin === b.origin;
			} catch {
		  return false;
			}
	  };

	  const redact = (s: string): string => {
			const clamp = s.length > 2000 ? s.slice(0, 2000) + '…[clamped]' : s;
			return clamp
		  .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
		  .replace(/("?token"?\s*:\s*")[^"]+"/gi, '$1[REDACTED]"')
		  .replace(/("?authorization"?\s*:\s*")[^"]+"/gi, '$1[REDACTED]"');
	  };

	  const doFetch = async (targetUrl: string): Promise<Response> => {
			return await this.f()(targetUrl, {
		  method,
		  headers,
		  body: hasBody ? JSON.stringify(req.body) : undefined,
		  signal: controller.signal,
			});
	  };

	  let attempt = 0;
	  const maxAttempts = this.maxRetries + 1;
	  let redirectCount = 0;
	  let currentUrl = url;
	  let res: Response | null = null;

	  try {
			while (true) {
		  try {
					res = await doFetch(currentUrl);
		  } catch (e: any) {
					if (controller.signal.aborted) {
			  throw new Error(`Request aborted after ${this.timeoutMs}ms while contacting ${currentUrl}`);
					}
					throw e;
		  }

		  const status = res.status;

		  // handle HEAD explicitly
		  if (method === 'HEAD') {
					clearTimeout(timeoutId);
					return undefined as unknown as T;
		  }

		  // Redirects
		  if (status >= 300 && status < 400 && redirectCount < this.maxRedirects) {
					const loc = res.headers.get('location');
					if (!loc) break;
					const next = new URL(loc, currentUrl).toString();
					if (!sameOrigin(currentUrl, next)) {
			  throw new Error('Cross-origin redirects are refused for safety');
					}
					redirectCount++;
					currentUrl = next;
					continue;
		  }

		  // Retry on 429/5xx
		  if ((status === 429 || (status >= 500 && status <= 599)) && attempt < maxAttempts - 1) {
					attempt++;
					const retryAfter = res.headers.get('retry-after');
					let delayMs = 0;
					if (retryAfter) {
			  const num = Number(retryAfter);
			  if (!Number.isNaN(num)) delayMs = num * 1000;
			  else {
							const d = new Date(retryAfter).getTime();
							if (!Number.isNaN(d)) delayMs = Math.max(0, d - Date.now());
			  }
					}
					if (delayMs === 0) delayMs = this.backoffMs(attempt);
					if (delayMs > 60_000) delayMs = 60_000;
					await new Promise((r) => setTimeout(r, delayMs));
					continue;
		  }

		  break;
			}
	  } finally {
			clearTimeout(timeoutId);
	  }

	  if (!res) throw new Error('Network error: no response');

	  if (res.status === 204 || res.status === 205) {
			return undefined as unknown as T;
	  }

	  if (res.status >= 400) {
			const raw = await this.safeText(res).catch(() => '');
			const safe = redact(raw);
			throw new Error(`[NotionClient] ${res.status} ${res.statusText}: ${safe}`);
	  }

	  const ct = res.headers.get('content-type') || '';
	  if (ct.includes('application/json')) {
		// @ts-ignore
			return (await (res as any).json()) as T;
	  } else {
			const text = await this.safeText(res).catch(() => '');
			return redact(text) as unknown as T;
	  }
	}

	private ensureCompliantPath(path: string) {
	  const p = path.toLowerCase();

	  const isDataSourceRetrieve = /^\/v1\/data_sources\/[^/]+$/.test(p);
	  const isDataSourceQuery    = /^\/v1\/data_sources\/[^/]+\/query$/.test(p);
	  const isLegacyDbRetrieve   = /^\/v1\/databases\/[^/]+$/.test(p);
	  const isLegacyDbQuery      = /^\/v1\/databases\/[^/]+\/query$/.test(p);

	  if ((isLegacyDbRetrieve || isLegacyDbQuery) && !(this.allowLegacy && this.downgradeNote)) {
			throw new Error('[SIG-SYS-NOT-023] Use /v1/data_sources/{id}[ /query ] for schema and queries. Legacy /v1/databases/* is blocked.');
	  }
	  if (this.allowLegacy && (isLegacyDbRetrieve || isLegacyDbQuery) && !this.downgradeNote) {
			throw new Error('[SIG-SYS-NOT-032] allowLegacy requires downgradeNote to be provided.');
	  }

	  const isBlocks   = /^\/v1\/blocks\//.test(p);
	  const isPages    = /^\/v1\/pages(\/|$)/.test(p);
	  const isComments = /^\/v1\/comments(\/|$)/.test(p);
	  const isDS       = isDataSourceRetrieve || isDataSourceQuery;
	  if (isBlocks || isPages || isComments || isDS) return;

	  if (/^\/v1\/databases\//.test(p) && !(this.allowLegacy && this.downgradeNote)) {
			throw new Error('[SIG-SYS-NOT-023] Legacy database endpoint blocked.');
	  }
	}

	private backoffMs(attempt: number) {
	  const base = Math.min(1000 * 2 ** (attempt - 1), 8000);
	  const jitter = Math.floor(Math.random() * 250);
	  return base + jitter;
	}

	private async safeText(res: Response) {
	  try {
		// @ts-ignore
			return await res.text();
	  } catch {
			return '';
	  }
	}
}
