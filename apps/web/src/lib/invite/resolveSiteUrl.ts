/** Canonical public site URL for invite links and emails. */
export function resolveSiteUrl(): string {
  return (
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://www.sanovacapital.com'
  ).replace(/\/$/, '');
}
