export type LoginDeviceContext = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export function detectDeviceContext(): LoginDeviceContext {
  if (typeof window === 'undefined') return 'unknown';

  const ua = navigator.userAgent || '';
  const uaLower = ua.toLowerCase();

  // Tablet detection
  const isTablet = /ipad|tablet|playbook|silk/i.test(uaLower) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(uaLower));
  if (isTablet) return 'tablet';

  // Mobile phone detection
  const isMobile = /android|iphone|ipod|windows phone|blackberry|mobile/i.test(uaLower);
  if (isMobile) return 'mobile';

  // Desktop / Laptop detection
  const isDesktop = /windows|macintosh|linux|cros/i.test(uaLower);
  if (isDesktop) return 'desktop';

  return 'unknown';
}
