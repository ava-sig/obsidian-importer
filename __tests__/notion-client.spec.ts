// [SIG-FLD-VAL-001] Declared in posture, amplified in field.
import { describe, it, expect } from 'vitest';
import { NotionClient } from '../src/formats/notion-client';

describe.skip('NotionClient (extended scenarios)', () => {
  it('retries 429 with Retry-After (to be implemented)', () => {
    expect(typeof NotionClient).toBe('function');
  });
});
