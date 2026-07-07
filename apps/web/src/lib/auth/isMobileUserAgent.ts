/** Server-side mobile detection (UA). Matches client useDeviceDetection / useMobilePortal intent. */
export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) {
    return false;
  }

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
}
