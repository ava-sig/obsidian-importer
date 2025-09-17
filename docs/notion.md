# Notion Importer (Data Sources)

This importer uses Notion Data Sources APIs, not legacy database endpoints.

- Notion-Version is pinned for stability.
- 429/5xx retries with backoff and Retry-After respect.
- Legacy DB endpoints are blocked unless explicitly allowed with a downgrade note.

Components:
- `src/formats/notion-client.ts` — transport + governance guardrails
- `src/formats/notion-convert.ts` — blocks to Markdown
- `src/formats/notion-schema.ts` — property schema to front matter
- `src/formats/notion-bases.ts` — views/filters/sorts/groups to YAML
- `src/formats/notion-utils.ts` — helpers
- `src/formats/notion-types.ts` — types

Testing:
- Add fixtures under `fixtures/notion/` for offline runs.
- See `tests/network/notionClient.test.ts` for client basics.
