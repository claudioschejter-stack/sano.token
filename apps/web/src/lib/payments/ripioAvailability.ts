/**
 * Whether Ripio is configured, without dragging its client along.
 *
 * `ripioClient` needs `node:crypto` to verify webhook signatures, and the
 * checkout policy is reachable from a browser bundle. Importing the client just
 * to read two environment variables pulled a Node built-in into the browser and
 * broke the build. The answer is a question small enough to stand alone.
 */
export function ripioConfigured(): boolean {
  return Boolean(process.env.RIPIO_CLIENT_ID?.trim() && process.env.RIPIO_CLIENT_SECRET?.trim());
}
