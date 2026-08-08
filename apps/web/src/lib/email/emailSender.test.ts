import { afterEach, describe, expect, it } from 'vitest';
import { bareEmailAddress, emailContactAddress, emailSenderDomain } from './emailSender';

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

describe('el correo habla de un solo dominio', () => {
  it('saca la dirección del formato con nombre visible', () => {
    expect(bareEmailAddress('Sanova Global <no-reply@sanovacapital.com>')).toBe(
      'no-reply@sanovacapital.com'
    );
    expect(bareEmailAddress('no-reply@sanovacapital.com')).toBe('no-reply@sanovacapital.com');
  });

  it('el dominio se normaliza, porque el DNS no distingue mayúsculas', () => {
    expect(emailSenderDomain('Sanova <no-reply@SanovaCapital.COM>')).toBe('sanovacapital.com');
  });

  it('el contacto del pie vive en el dominio que firma el correo', () => {
    // The footer used to link legales@sanova.global while the message was signed
    // by sanovacapital.com: a cross-domain contact in a message that is otherwise
    // just a six digit number.
    delete process.env.EMAIL_CONTACT_ADDRESS;
    delete process.env.CONTACT_FROM_EMAIL;
    process.env.ONBOARDING_FROM_EMAIL = 'Sanova Global <no-reply@sanovacapital.com>';

    expect(emailContactAddress()).toBe('info@sanovacapital.com');
  });

  it('sigue al remitente si cambia de dominio, en vez de quedar fijo', () => {
    delete process.env.EMAIL_CONTACT_ADDRESS;
    process.env.ONBOARDING_FROM_EMAIL = 'Sanova <no-reply@mail.sanovacapital.com>';

    expect(emailContactAddress()).toBe('info@mail.sanovacapital.com');
  });

  it('una dirección explícita gana sobre la derivada', () => {
    process.env.ONBOARDING_FROM_EMAIL = 'Sanova <no-reply@sanovacapital.com>';
    process.env.EMAIL_CONTACT_ADDRESS = 'soporte@sanovacapital.com';

    expect(emailContactAddress()).toBe('soporte@sanovacapital.com');
  });

  it('sin arroba no hay dominio', () => {
    expect(emailSenderDomain('Sanova Global')).toBeNull();
  });
});
