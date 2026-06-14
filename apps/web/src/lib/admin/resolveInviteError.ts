import type { Messages } from '../../i18n/locales/en';

type InviteErrorLabels = Messages['adminInviteWhatsApp'];

export function resolveAdminInviteError(
  code: string | undefined,
  labels: InviteErrorLabels
): string {
  switch (code) {
    case 'INVITE_ALREADY_PENDING':
      return labels.inviteAlreadyPending;
    case 'EMAIL_ALREADY_STAFF':
      return labels.emailAlreadyStaff;
    case 'ADVISOR_NOT_FOUND':
      return labels.advisorNotFound;
    case 'ADVISOR_REQUIRES_UPLINE':
      return labels.advisorRequiresUpline;
    case 'INVALID_EMAIL':
      return labels.invalidEmail;
    default:
      return labels.createError;
  }
}
