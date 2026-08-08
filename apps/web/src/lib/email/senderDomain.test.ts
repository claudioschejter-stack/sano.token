import { describe, expect, it } from 'vitest';

/**
 * The domain the login code is signed as. Getting it wrong is why the diagnostic
 * exists: if this does not match a verified domain in Resend, the message goes
 * out signed by resend.dev and lands in spam, while the send itself reports as
 * accepted and nothing in the platform looks wrong.
 */
function domainOf(from: string): string | null {
  const match = /<([^>]+)>/.exec(from);
  const address = (match?.[1] ?? from).trim();
  const at = address.lastIndexOf('@');
  return at === -1 ? null : address.slice(at + 1).toLowerCase();
}

describe('de qué dominio sale el correo', () => {
  it('lee el dominio del formato con nombre visible', () => {
    expect(domainOf('Sanova Global <no-reply@sanovacapital.com>')).toBe('sanovacapital.com');
  });

  it('lee el dominio de una dirección pelada', () => {
    expect(domainOf('no-reply@sanovacapital.com')).toBe('sanovacapital.com');
  });

  it('tolera espacios alrededor', () => {
    expect(domainOf('  Sanova <  hola@sanovacapital.com  >  ')).toBe('sanovacapital.com');
  });

  it('normaliza a minúsculas, porque el DNS no distingue', () => {
    expect(domainOf('Sanova <no-reply@SanovaCapital.COM>')).toBe('sanovacapital.com');
  });

  it('detecta un subdominio, que se verifica aparte del dominio raíz', () => {
    // mail.sanovacapital.com verificado no cubre sanovacapital.com ni al revés.
    expect(domainOf('Sanova <no-reply@mail.sanovacapital.com>')).toBe('mail.sanovacapital.com');
  });

  it('devuelve null cuando no hay arroba', () => {
    expect(domainOf('Sanova Global')).toBeNull();
  });
});
