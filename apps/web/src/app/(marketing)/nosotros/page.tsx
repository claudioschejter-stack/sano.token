import { redirect } from 'next/navigation';

/**
 * Temporarily hidden until further notice — keep the route so old links
 * and locale-prefixed URLs (`/he/nosotros`, etc.) still resolve cleanly.
 */
export default function NosotrosPageRoute() {
  redirect('/');
}
