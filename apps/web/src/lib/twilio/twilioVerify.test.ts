import { afterEach, describe, expect, it } from 'vitest';
import { twilioVerifyChannel } from './twilioVerify';

describe('twilioVerifyChannel', () => {
  afterEach(() => {
    delete process.env.TWILIO_VERIFY_CHANNEL;
    delete process.env.TWILIO_WHATSAPP_NUMBER;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  it('uses explicit TWILIO_VERIFY_CHANNEL when set', () => {
    process.env.TWILIO_VERIFY_CHANNEL = 'sms';
    expect(twilioVerifyChannel()).toBe('sms');
  });

  it('defaults to sms when only TWILIO_PHONE_NUMBER is configured', () => {
    process.env.TWILIO_PHONE_NUMBER = '+14155238886';
    expect(twilioVerifyChannel()).toBe('sms');
  });

  it('defaults to whatsapp when TWILIO_WHATSAPP_NUMBER is configured', () => {
    process.env.TWILIO_WHATSAPP_NUMBER = '+14155238886';
    expect(twilioVerifyChannel()).toBe('whatsapp');
  });
});
