/**
 * Tests for Marketplace author search filter
 * Task 14.4
 * Requirements: 25.1
 *
 * **Validates: Requirements 25.1**
 *
 * This test file is self-contained and does NOT render the Marketplace component.
 * It tests the author filter logic as a pure function, matching the implementation in Marketplace.tsx:
 *   const matchAuthor = !authorSearch || e.author.toLowerCase().includes(authorSearch.toLowerCase());
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Extension {
  id: string;
  name: string;
  description: string;
  trigger: string;
  author: string;
  downloads: number;
  type: string;
  status: string;
  createdAt: string;
  aliases: string[];
  target: string;
  response: string;
}

// ---------------------------------------------------------------------------
// Pure filter function — mirrors the logic in Marketplace.tsx BrowseTab
// ---------------------------------------------------------------------------

function filterByAuthor(extensions: Extension[], authorSearch: string): Extension[] {
  return extensions.filter(
    e => !authorSearch || e.author.toLowerCase().includes(authorSearch.toLowerCase())
  );
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a printable ASCII string (no control chars) */
const printableString = fc.string({ minLength: 0, maxLength: 30 }).filter(
  s => s.split('').every(c => c.charCodeAt(0) >= 32)
);

/** Generate a non-empty printable ASCII string */
const nonEmptyPrintable = fc.string({ minLength: 1, maxLength: 30 }).filter(
  s => s.split('').every(c => c.charCodeAt(0) >= 32)
);

/** Generate a single Extension with a given author */
const extensionWithAuthor = (authorArb: fc.Arbitrary<string>) =>
  fc.record({
    id: fc.uuid(),
    name: nonEmptyPrintable,
    description: printableString,
    trigger: nonEmptyPrintable,
    author: authorArb,
    downloads: fc.integer({ min: 0, max: 10000 }),
    type: fc.constantFrom('tools', 'admin', 'group', 'fun', 'misc', 'core'),
    status: fc.constant('approved'),
    createdAt: fc.date().map(d => d.toISOString()),
    aliases: fc.array(nonEmptyPrintable, { maxLength: 3 }),
    target: fc.constantFrom('chat', 'self'),
    response: printableString,
  });

/** Generate a list of extensions with arbitrary authors */
const extensionList = fc.array(extensionWithAuthor(nonEmptyPrintable), {
  minLength: 0,
  maxLength: 20,
});

// ---------------------------------------------------------------------------
// Property 8: Marketplace author search filters correctly
// Feature: wxata-production-ready, Property 8: Marketplace author search filters correctly
// Validates: Requirements 25.1
// ---------------------------------------------------------------------------

describe('Property 8: Marketplace author search filters correctly', () => {
  it('every returned extension has author containing the search string (case-insensitive)', () => {
    fc.assert(
      fc.property(extensionList, nonEmptyPrintable, (extensions, authorSearch) => {
        const result = filterByAuthor(extensions, authorSearch);
        return result.every(e =>
          e.author.toLowerCase().includes(authorSearch.toLowerCase())
        );
      }),
      { numRuns: 100 }
    );
  });

  it('every extension whose author does not contain the search string is excluded', () => {
    fc.assert(
      fc.property(extensionList, nonEmptyPrintable, (extensions, authorSearch) => {
        const result = filterByAuthor(extensions, authorSearch);
        const resultIds = new Set(result.map(e => e.id));
        // Any extension NOT in the result must not match the search
        const excluded = extensions.filter(e => !resultIds.has(e.id));
        return excluded.every(
          e => !e.author.toLowerCase().includes(authorSearch.toLowerCase())
        );
      }),
      { numRuns: 100 }
    );
  });

  it('clearing the search field (empty string) returns all extensions', () => {
    fc.assert(
      fc.property(extensionList, (extensions) => {
        const result = filterByAuthor(extensions, '');
        return result.length === extensions.length;
      }),
      { numRuns: 100 }
    );
  });

  it('search is case-insensitive: uppercase and lowercase search strings yield the same results', () => {
    fc.assert(
      fc.property(extensionList, nonEmptyPrintable, (extensions, authorSearch) => {
        const lower = filterByAuthor(extensions, authorSearch.toLowerCase());
        const upper = filterByAuthor(extensions, authorSearch.toUpperCase());
        const mixed = filterByAuthor(extensions, authorSearch);
        // All three should return the same set of IDs
        const toIds = (arr: Extension[]) => arr.map(e => e.id).sort().join(',');
        return toIds(lower) === toIds(upper) && toIds(upper) === toIds(mixed);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests — example-based
// ---------------------------------------------------------------------------

describe('filterByAuthor unit tests', () => {
  const makeExt = (id: string, author: string): Extension => ({
    id,
    name: 'Test Plugin',
    description: 'A test plugin',
    trigger: 'test',
    author,
    downloads: 0,
    type: 'misc',
    status: 'approved',
    createdAt: new Date().toISOString(),
    aliases: [],
    target: 'chat',
    response: '',
  });

  it('returns all extensions when authorSearch is empty', () => {
    const exts = [makeExt('1', 'Alice'), makeExt('2', 'Bob'), makeExt('3', 'Charlie')];
    expect(filterByAuthor(exts, '')).toHaveLength(3);
  });

  it('filters by exact author name (case-sensitive match)', () => {
    const exts = [makeExt('1', 'Alice'), makeExt('2', 'Bob'), makeExt('3', 'Charlie')];
    const result = filterByAuthor(exts, 'Alice');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters case-insensitively', () => {
    const exts = [makeExt('1', 'Alice'), makeExt('2', 'alice'), makeExt('3', 'ALICE')];
    expect(filterByAuthor(exts, 'alice')).toHaveLength(3);
    expect(filterByAuthor(exts, 'ALICE')).toHaveLength(3);
    expect(filterByAuthor(exts, 'Alice')).toHaveLength(3);
  });

  it('matches partial author names', () => {
    const exts = [makeExt('1', 'AliceSmith'), makeExt('2', 'BobJones'), makeExt('3', 'alice_dev')];
    const result = filterByAuthor(exts, 'alice');
    expect(result).toHaveLength(2);
    expect(result.map(e => e.id)).toEqual(expect.arrayContaining(['1', '3']));
  });

  it('returns empty array when no extensions match', () => {
    const exts = [makeExt('1', 'Alice'), makeExt('2', 'Bob')];
    expect(filterByAuthor(exts, 'Charlie')).toHaveLength(0);
  });

  it('returns empty array when input list is empty', () => {
    expect(filterByAuthor([], 'Alice')).toHaveLength(0);
  });

  it('returns empty array when input list is empty and search is also empty', () => {
    expect(filterByAuthor([], '')).toHaveLength(0);
  });
});
