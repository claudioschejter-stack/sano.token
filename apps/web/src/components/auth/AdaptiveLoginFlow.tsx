'use client';

import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { DesktopLoginFlow } from './DesktopLoginFlow';
import { MobileLoginFlow } from './MobileLoginFlow';

type AdaptiveLoginFlowProps = {
  callbackUrl?: string;
  className?: string;
  initialEmail?: string;
  registerHref?: string;
};

export function AdaptiveLoginFlow(props: AdaptiveLoginFlowProps) {
  const { isDesktop } = useDeviceDetection();

  if (isDesktop) {
    return <DesktopLoginFlow {...props} />;
  }

  return <MobileLoginFlow {...props} />;
}
