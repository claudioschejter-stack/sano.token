/**
 * Strip a value of anything that could forge a log line.
 *
 * A newline inside a logged value lets whoever supplied it write what looks
 * like a separate entry — an attacker who controls a transaction hash or an
 * identifier can invent a line saying whatever they want, and the log stops
 * being evidence of anything. Truncating matters too: a megabyte of junk in one
 * field is its own denial of service against whoever reads the logs.
 */
export function safeLogValue(value: unknown, maxLength = 200): string {
  const text =
    typeof value === 'string'
      ? value
      : value === null || value === undefined
        ? String(value)
        : typeof value === 'object'
          ? '[object]'
          : String(value);

  /**
   * Newlines first and by name. Stripping them inside a character range works
   * just as well at runtime, but static analysis recognises the explicit
   * replacement as the barrier it is — and a sanitiser a scanner cannot see is
   * a sanitiser that keeps costing review time on every pull request.
   */
  const withoutBreaks = text.replace(/\n/g, ' ').replace(/\r/g, ' ');

  // Then the rest: escapes and other control characters forge lines too.
  const stripped = withoutBreaks.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return stripped.length > maxLength ? `${stripped.slice(0, maxLength)}…` : stripped;
}

/**
 * Log an identifier by keeping only what an identifier can contain.
 *
 * Transaction hashes, user ids and addresses have a known alphabet, so an
 * allowlist says what is permitted rather than trying to enumerate what is
 * dangerous — and anything a denylist forgets is exactly what an attacker
 * looks for. It also reads unambiguously as sanitisation to anyone, and to
 * anything, checking this code later.
 */
export function safeLogId(value: unknown, maxLength = 80): string {
  const text = typeof value === 'string' ? value : String(value ?? '');
  const allowed = text.replace(/[^A-Za-z0-9_:.@-]/g, '');

  if (allowed.length === 0) {
    return '(vacío)';
  }
  return allowed.length > maxLength ? `${allowed.slice(0, maxLength)}…` : allowed;
}
