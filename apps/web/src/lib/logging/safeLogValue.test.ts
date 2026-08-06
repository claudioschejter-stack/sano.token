import { describe, expect, it } from 'vitest';
import { safeLogValue } from './safeLogValue';

/**
 * A newline inside a logged value lets whoever supplied it write what looks like
 * a separate entry. Somebody who controls a transaction hash could invent a line
 * saying whatever they want, and the log stops being evidence of anything.
 */
describe('safeLogValue', () => {
  it('leaves an ordinary value alone', () => {
    expect(safeLogValue('0xabc123')).toBe('0xabc123');
  });

  it('takes away the newline that would forge a second line', () => {
    const forged = '0xabc\n[auth] admin login succeeded';
    expect(safeLogValue(forged)).not.toContain('\n');
    expect(safeLogValue(forged)).toBe('0xabc [auth] admin login succeeded');
  });

  it('strips carriage returns and escapes, not just newlines', () => {
    expect(safeLogValue('a\rb\u001b[2Kc')).toBe('a b [2Kc');
  });

  /** A megabyte in one field is its own attack on whoever reads the logs. */
  it('truncates a value long enough to bury the rest of the log', () => {
    const long = 'x'.repeat(5000);
    const logged = safeLogValue(long);

    expect(logged.length).toBeLessThanOrEqual(201);
    expect(logged.endsWith('…')).toBe(true);
  });

  it('handles values that are not strings', () => {
    expect(safeLogValue(null)).toBe('null');
    expect(safeLogValue(undefined)).toBe('undefined');
    expect(safeLogValue(42)).toBe('42');
    expect(safeLogValue({ secret: 'x' })).toBe('[object]');
  });
});
