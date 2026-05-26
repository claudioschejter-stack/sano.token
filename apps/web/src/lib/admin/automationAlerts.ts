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
}) {
  const recipients = adminEmails();
  if (!recipients.length) {
    return;
  }

  await Promise.all(
    recipients.map((to) =>
      sendTransactionalEmail({
        to,
        subject: `Sanova RWA automation alert: ${input.title}`,
        text: `${input.message}\n\nProject: ${input.projectId}`,
        html: `<p>${input.message}</p><p><strong>Project:</strong> ${input.projectId}</p>`
      })
    )
  );
}
