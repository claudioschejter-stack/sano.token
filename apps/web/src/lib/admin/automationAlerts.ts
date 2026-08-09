import { prisma } from '@sanova/database';
import { assetAlertLabel } from './assetAlertLabel';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';

/**
 * Put the token code in front of every alert, wherever it came from.
 *
 * Eight call sites pass a project title, and a title does not identify a project:
 * Añelo's UV2 and UV3 have the same words in a different order and neither says
 * which building it is. Resolving the code here instead of at each caller means
 * the alert added next month is unambiguous without anyone remembering to make
 * it so.
 *
 * Never let this stop an alert. A database that cannot answer is a reason to send
 * the message as it came, not a reason to stay quiet.
 */
async function withProjectCode(
  projectId: string,
  title: string
): Promise<{ headline: string; contractAddress: string | null }> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { tokenSymbol: true, contractAddress: true }
    });
    if (!project) {
      return { headline: title, contractAddress: null };
    }
    return {
      headline: assetAlertLabel({ title, ...project }),
      contractAddress: project.contractAddress ?? null
    };
  } catch {
    return { headline: title, contractAddress: null };
  }
}

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
  const { headline, contractAddress } = await withProjectCode(input.projectId, input.title);

  // The contract is what an operator acts on, so name it rather than make them
  // look it up — that lookup is where the wrong project gets picked.
  const reference = contractAddress
    ? `${input.projectId} · token ${contractAddress}`
    : input.projectId;

  const slackLine = `[Sanova RWA ${severity}] ${headline} — ${input.message} (project: ${reference})`;
  await notifySlack(slackLine);

  await Promise.all(
    recipients.map((to) =>
      sendTransactionalEmail({
        to,
        subject: `Sanova RWA ${severity} alert: ${headline}`,
        text: `${input.message}\n\nProject: ${reference}`,
        html: `<p>${input.message}</p><p><strong>Project:</strong> ${reference}</p>`
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
