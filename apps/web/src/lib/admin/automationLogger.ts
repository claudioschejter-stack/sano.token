export type AutomationLogLevel = 'info' | 'warn' | 'error';

export function logAutomationEvent(input: {
  level?: AutomationLogLevel;
  event: string;
  projectId?: string | null;
  jobId?: string | null;
  step?: string | null;
  status?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    service: 'sanova-rwa-automation',
    event: input.event,
    projectId: input.projectId ?? null,
    jobId: input.jobId ?? null,
    step: input.step ?? null,
    status: input.status ?? null,
    message: input.message ?? null,
    metadata: input.metadata ?? {},
    timestamp: new Date().toISOString()
  };

  if (input.level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }

  if (input.level === 'warn') {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}
