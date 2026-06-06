import { notifyAutomationIssue } from '../admin/automationAlerts';

type CaptureInput = {
  error: unknown;
  projectId?: string | null;
  title: string;
  severity?: 'warning' | 'critical';
  tags?: Record<string, string>;
};

async function captureSentry(error: unknown, tags?: Record<string, string>) {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(error, { tags });
  } catch {
    // Sentry optional in local/test
  }
}

/** Report automation/cron failures to Sentry + admin email (+ Slack via automationAlerts). */
export async function captureAutomationError(input: CaptureInput): Promise<void> {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const projectId = input.projectId ?? 'platform';

  await captureSentry(input.error, {
    ...input.tags,
    automationTitle: input.title,
    projectId
  });

  await notifyAutomationIssue({
    projectId,
    title: input.title,
    message,
    severity: input.severity ?? 'critical'
  }).catch(() => undefined);
}
