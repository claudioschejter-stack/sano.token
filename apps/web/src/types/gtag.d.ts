// Type declaration for Google Analytics gtag function on window
interface Window {
  gtag?: (
    command: 'consent' | 'config' | 'event' | 'js' | 'set',
    target: string | Date,
    params?: Record<string, unknown>
  ) => void;
  dataLayer?: unknown[];
}
