import { describe, expect, it } from 'vitest';

/**
 * Which failures mean "this tab is running against a build that no longer
 * exists". Getting this wrong in either direction is bad: too narrow and the
 * investor keeps a dead page, too broad and any error triggers a reload.
 */
function isStaleChunkError(message: string): boolean {
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

describe('qué errores indican un build viejo', () => {
  it('reconoce las formas que toma un chunk que ya no está', () => {
    expect(isStaleChunkError('ChunkLoadError: Loading chunk 4823 failed')).toBe(true);
    expect(isStaleChunkError('Loading chunk app-layout failed')).toBe(true);
    expect(
      isStaleChunkError('TypeError: Failed to fetch dynamically imported module: /_next/static/x.js')
    ).toBe(true);
    expect(isStaleChunkError('error loading dynamically imported module')).toBe(true);
  });

  it('no reacciona a errores que no tienen nada que ver', () => {
    // Reloading on these would hide real failures behind a refresh.
    expect(isStaleChunkError('TypeError: undefined is not a function')).toBe(false);
    expect(isStaleChunkError('PRIVY_SEND_TRANSACTION_FAILED:400')).toBe(false);
    expect(isStaleChunkError('NetworkError when attempting to fetch resource')).toBe(false);
    expect(isStaleChunkError('')).toBe(false);
  });

  it('solo los recursos de _next cuentan como build viejo', () => {
    const isBuildAsset = (src: string) => src.includes('/_next/static/');

    expect(isBuildAsset('https://www.sanovacapital.com/_next/static/chunks/app/page-abc.js')).toBe(
      true
    );
    // An extension or a third party script failing is not our build.
    expect(isBuildAsset('moz-extension://abc/scripts/contentscript.js')).toBe(false);
    expect(isBuildAsset('https://auth.privy.io/embedded-wallets.js')).toBe(false);
  });
});
