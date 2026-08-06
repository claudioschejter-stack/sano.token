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

  // Control characters, not just newlines: carriage returns and escapes forge lines too.
  const stripped = text.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return stripped.length > maxLength ? `${stripped.slice(0, maxLength)}…` : stripped;
}
