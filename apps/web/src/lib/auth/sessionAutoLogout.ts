export const SESSION_INACTIVITY_MS = 3 * 60 * 1000;

export const JWT_STORAGE_KEY = 'sanova.jwt';

/** Broadcast key so all tabs sign out together. */
export const SESSION_LOGOUT_BROADCAST_KEY = 'sanova.session.logout';

export const SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  '__Host-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token'
] as const;
