export type SumsubWebhookPayload = {
  applicantId?: string;
  externalUserId?: string;
  reviewStatus?: string;
  reviewResult?: {
    reviewAnswer?: string;
  };
  type?: string;
};
