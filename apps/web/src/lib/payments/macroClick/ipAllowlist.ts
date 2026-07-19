import { MACRO_CLICK_WEBHOOK_CIDRS } from './config';

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

function cidrContains(ip: string, cidr: string): boolean {
  const [network, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  const ipInt = ipv4ToInt(ip);
  const netInt = network ? ipv4ToInt(network) : null;
  if (ipInt === null || netInt === null || !Number.isFinite(bits) || bits < 0 || bits > 32) {
    return false;
  }
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

export function isMacroClickWebhookIpAllowed(ip: string | null | undefined): boolean {
  const cleaned = ip?.trim().replace(/^::ffff:/, '');
  if (!cleaned) return false;
  if (process.env.MACRO_CLICK_SKIP_IP_CHECK === 'true') return true;
  if (process.env.NODE_ENV !== 'production' && (cleaned === '127.0.0.1' || cleaned === '::1')) {
    return true;
  }
  return MACRO_CLICK_WEBHOOK_CIDRS.some((cidr) => cidrContains(cleaned, cidr));
}

export function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.replace(/^::ffff:/, '');
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp ? realIp.replace(/^::ffff:/, '') : null;
}
