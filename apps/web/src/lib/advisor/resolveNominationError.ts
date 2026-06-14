import type { Messages } from '../../i18n/locales/en';

type NominationErrorLabels = Messages['advisorPortal']['nominationErrors'];

export function resolveNominationError(code: string | undefined, labels: NominationErrorLabels): string {
  switch (code) {
    case 'NOMINATION_ALREADY_PENDING':
      return labels.alreadyPending;
    case 'EMAIL_ALREADY_STAFF':
      return labels.alreadyStaff;
    case 'INVESTOR_HAS_ACTIVE_HOLDINGS':
      return labels.investorHasHoldings;
    case 'INVALID_EMAIL':
      return labels.invalidEmail;
    default:
      return labels.generic;
  }
}
