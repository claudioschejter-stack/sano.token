import { sendTransactionalEmail } from '../email/sendTransactionalEmail';

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

  await Promise.all(
    recipients.map((to) =>
      sendTransactionalEmail({
        to,
        subject: `Sanova RWA ${input.severity ?? 'warning'} alert: ${input.title}`,
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
