import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { emailContactAddress, emailFromAddress, emailSenderDomain } from '../../../../lib/email/emailSender';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Why the login code lands in spam.
 *
 * A second factor that arrives in the junk folder is a locked door: the investor
 * has the password, the code exists, and they still cannot get in. And it fails
 * silently — Resend reports the send as accepted, so nothing in the platform
 * looks wrong.
 *
 * Deliverability is decided by DNS records the platform does not control from
 * code, so guessing is expensive. This asks the two authorities directly: Resend,
 * for whether the sending domain is verified with its SPF and DKIM records, and
 * the DNS itself for DMARC, which Resend does not manage and whose absence is the
 * usual reason a correctly signed message still gets filtered.
 */

type ResendDomain = {
  id: string;
  name: string;
  status?: string;
  region?: string;
  records?: Array<{ record?: string; name?: string; type?: string; status?: string; value?: string }>;
};

async function resendDomains(apiKey: string): Promise<ResendDomain[] | { error: string }> {
  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store'
    });
    if (!response.ok) {
      return { error: `RESEND_${response.status}` };
    }
    const body = (await response.json()) as { data?: ResendDomain[] } | ResendDomain[];
    return Array.isArray(body) ? body : body.data ?? [];
  } catch {
    return { error: 'RESEND_UNREACHABLE' };
  }
}

/** DMARC over DNS-over-HTTPS, since there is no resolver in this runtime. */
async function dmarcRecord(domain: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=_dmarc.${encodeURIComponent(domain)}&type=TXT`,
      { headers: { accept: 'application/dns-json' }, cache: 'no-store' }
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { Answer?: Array<{ data?: string }> };
    const txt = body.Answer?.map((row) => row.data ?? '').find((row) => /v=DMARC1/i.test(row));
    return txt ? txt.replace(/^"|"$/g, '') : null;
  } catch {
    return null;
  }
}

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const from = emailFromAddress();
  const domain = emailSenderDomain(from);
  const apiKey = process.env.RESEND_API_KEY?.trim();

  const checks: Array<{ id: string; ok: boolean; detail: string; fix?: string }> = [];

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      from,
      domain,
      checks: [
        {
          id: 'resend_key',
          ok: false,
          detail: 'RESEND_API_KEY no está configurada: no se envía ningún correo.',
          fix: 'Cargá RESEND_API_KEY en Vercel.'
        }
      ]
    });
  }

  if (!domain) {
    return NextResponse.json({
      ok: false,
      from,
      domain: null,
      checks: [
        { id: 'from_address', ok: false, detail: `No se pudo leer el dominio de "${from}".` }
      ]
    });
  }

  const domains = await resendDomains(apiKey);
  if ('error' in domains) {
    checks.push({
      id: 'resend_domains',
      ok: false,
      detail: `No se pudo consultar los dominios en Resend (${domains.error}).`
    });
  } else {
    const match = domains.find((row) => row.name?.toLowerCase() === domain);
    if (!match) {
      checks.push({
        id: 'domain_registered',
        ok: false,
        detail: `El dominio ${domain} no está dado de alta en Resend. Los correos salen firmados por resend.dev, y por eso caen en spam.`,
        fix: `Agregá ${domain} en resend.com/domains y cargá los CNAME de DKIM y el TXT de SPF que te da.`
      });
    } else {
      const verified = (match.status ?? '').toLowerCase() === 'verified';
      checks.push({
        id: 'domain_verified',
        ok: verified,
        detail: verified
          ? `${domain} está verificado en Resend.`
          : `${domain} está dado de alta pero su estado es "${match.status ?? 'desconocido'}".`,
        fix: verified ? undefined : 'Faltan registros DNS por propagar o cargar. Ver el detalle de records.'
      });

      for (const record of match.records ?? []) {
        const ok = (record.status ?? '').toLowerCase() === 'verified';
        checks.push({
          id: `dns_${(record.record ?? record.type ?? 'record').toLowerCase()}`,
          ok,
          detail: `${record.record ?? record.type}: ${record.status ?? 'sin estado'} (${record.name ?? ''})`,
          fix: ok ? undefined : `Cargá este registro en el DNS de ${domain}: ${record.type} ${record.name} = ${record.value ?? ''}`
        });
      }
    }
  }

  const dmarc = await dmarcRecord(domain);
  checks.push({
    id: 'dmarc',
    ok: Boolean(dmarc),
    detail: dmarc
      ? `DMARC presente: ${dmarc}`
      : `No hay registro DMARC en _dmarc.${domain}. Gmail y Outlook filtran más fuerte sin él, incluso con SPF y DKIM correctos.`,
    fix: dmarc
      ? undefined
      : `Agregá un TXT en _dmarc.${domain} con: v=DMARC1; p=none; rua=mailto:dmarc@${domain}`
  });

  /**
   * A contact on another domain is a cross-domain link inside a message that is
   * otherwise just a six digit code — the shape filters are built to distrust.
   */
  const contact = emailContactAddress();
  const contactDomain = emailSenderDomain(contact);
  checks.push({
    id: 'contact_same_domain',
    ok: contactDomain === domain,
    detail:
      contactDomain === domain
        ? `El contacto del pie (${contact}) está en el mismo dominio que firma el correo.`
        : `El contacto del pie (${contact}) está en otro dominio que el remitente (${domain}).`,
    fix:
      contactDomain === domain
        ? undefined
        : `Cargá EMAIL_CONTACT_ADDRESS con una casilla de ${domain} que alguien lea.`
  });

  return NextResponse.json({
    ok: checks.every((row) => row.ok),
    from,
    domain,
    contact,
    checks
  });
}
