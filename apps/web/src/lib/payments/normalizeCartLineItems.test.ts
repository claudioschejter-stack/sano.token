import { describe, expect, it } from 'vitest';
import { normalizeCartLineItems } from './normalizeCartLineItems';

describe('normalizeCartLineItems', () => {
  it('keeps valid lines', () => {
    expect(
      normalizeCartLineItems([
        { projectId: 'proj-1', tokenCount: 2 },
        { projectId: '  proj-2  ', tokenCount: 1 }
      ])
    ).toEqual([
      { projectId: 'proj-1', tokenCount: 2 },
      { projectId: 'proj-2', tokenCount: 1 }
    ]);
  });

  it('drops invalid rows and non-arrays', () => {
    expect(normalizeCartLineItems(null)).toEqual([]);
    expect(normalizeCartLineItems({ projectId: 'x', tokenCount: 1 })).toEqual([]);
    expect(
      normalizeCartLineItems([
        { projectId: '', tokenCount: 1 },
        { projectId: 'ok', tokenCount: 1.5 },
        { projectId: 'ok2', tokenCount: 0 },
        null,
        'bad'
      ])
    ).toEqual([]);
  });

  it('parses JSON string payloads', () => {
    expect(normalizeCartLineItems(JSON.stringify([{ projectId: 'proj-1', tokenCount: 1 }]))).toEqual([
      { projectId: 'proj-1', tokenCount: 1 }
    ]);
  });
});
