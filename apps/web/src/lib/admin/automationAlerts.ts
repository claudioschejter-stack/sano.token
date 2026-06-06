import { sendTransactionalEmail } from '../email/sendTransactionalEmail';

async function notifySlack(text: string) {
  const webhook = process.env.AUTOMATION_SLACK_WEBHOOK_URL?.trim();
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
  } catch (error) {
    console.warn('[automationAlerts] Slack webhook failed:', error);
  }
}

function adminEmails(): string[] {
  return (process.env.AUTH_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

export async function notifyAutomationIssue(input: {
  projectId: string;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
}) {
  const recipients = adminEmails();
  if (!recipients.length) {
    return;
  }

  const severity = input.severity ?? 'warning';
  const slackLine = `[Sanova RWA ${severity}] ${input.title} — ${input.message} (project: ${input.projectId})`;
  await notifySlack(slackLine);

  await Promise.all(
    recipients.map((to) =>
      sendTransactionalEmail({
        to,
        subject: `Sanova RWA ${severity} alert: ${input.title}`,
        text: `${input.message}\n\nProject: ${input.projectId}`,
        html: `<p>${input.message}</p><p><strong>Project:</strong> ${input.projectId}</p>`
      })
    )
  );
}

export function notifyGasIssue(projectId: string, title: string, message: string) {
  return notifyAutomationIssue({ projectId, title, message, severity: 'critical' });
}

export function notifyCircuitBreaker(projectId: string, title: string, reason: string) {
  return notifyAutomationIssue({
    projectId,
    title,
    message: `Circuit breaker activo: ${reason}`,
    severity: 'critical'
  });
}

export function notifyMorphoLiquidity(projectId: string, title: string, status: string) {
  return notifyAutomationIssue({
    projectId,
    title,
    message: `Liquidez Morpho requiere atención: ${status}`,
    severity: status === 'LIQUID' ? 'info' : 'warning'
  });
}

export function notifyExplorerVerification(projectId: string, title: string, status: string) {
  return notifyAutomationIssue({
    projectId,
    title,
    message: `Verificación explorer: ${status}`,
    severity: status === 'VERIFIED' ? 'info' : 'warning'
  });
}

export function notifyKycAllowlist(projectId: string, title: string, walletAddress: string, approved: boolean) {
  return notifyAutomationIssue({
    projectId,
    title,
    message: `Allowlist on-chain ${approved ? 'aprobada' : 'revocada'} para ${walletAddress}.`,
    severity: 'info'
  });
}
