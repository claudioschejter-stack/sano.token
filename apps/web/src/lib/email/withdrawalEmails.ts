import { sendTransactionalEmail } from './sendTransactionalEmail';
import { renderEmailShell, renderEmailButton } from './emailTemplate';

function basescanTxUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

export async function sendWithdrawalConfirmedEmail(input: {
  to: string;
  name?: string | null;
  amountUsd: number;
  method?: string;
  reference: string;
}): Promise<void> {
  const greetingName = input.name?.trim() || 'Inversor/a';
  const amount = input.amountUsd.toFixed(2);
  const isFiat = input.method === 'FIAT';

  const bodyHtml = isFiat
    ? `
    <h2 style="margin:0 0 16px">Retiro confirmado</h2>
    <p>Hola ${greetingName},</p>
    <p>Tu retiro de <strong>USD ${amount}</strong> fue transferido a la cuenta bancaria/billetera digital que nos indicaste.</p>
    <p style="color:#64748b;font-size:13px">Referencia de la transferencia: ${input.reference}</p>
  `
    : `
    <h2 style="margin:0 0 16px">Retiro confirmado</h2>
    <p>Hola ${greetingName},</p>
    <p>Tu retiro de <strong>USD ${amount}</strong> fue enviado a tu wallet vinculada.</p>
    ${renderEmailButton(basescanTxUrl(input.reference), 'Ver transacción en Basescan')}
    <p style="color:#64748b;font-size:13px">Hash: ${input.reference}</p>
  `;

  await sendTransactionalEmail({
    to: input.to,
    subject: `Retiro confirmado · USD ${amount}`,
    text: isFiat
      ? `Hola ${greetingName}, tu retiro de USD ${amount} fue transferido. Referencia: ${input.reference}`
      : `Hola ${greetingName}, tu retiro de USD ${amount} fue enviado. Transacción: ${basescanTxUrl(input.reference)}`,
    html: renderEmailShell({ bodyHtml })
  });
}

export async function sendWithdrawalRejectedEmail(input: {
  to: string;
  name?: string | null;
  amountUsd: number;
  reason: string;
}): Promise<void> {
  const greetingName = input.name?.trim() || 'Inversor/a';
  const amount = input.amountUsd.toFixed(2);

  const bodyHtml = `
    <h2 style="margin:0 0 16px">Retiro rechazado</h2>
    <p>Hola ${greetingName},</p>
    <p>Tu solicitud de retiro de <strong>USD ${amount}</strong> no pudo procesarse y el saldo fue restituido a tu cuenta.</p>
    <p><strong>Motivo:</strong> ${input.reason}</p>
    <p>Si tenés dudas, respondé este email y te ayudamos.</p>
  `;

  await sendTransactionalEmail({
    to: input.to,
    subject: `Retiro rechazado · USD ${amount}`,
    text: `Hola ${greetingName}, tu retiro de USD ${amount} fue rechazado y el saldo fue restituido. Motivo: ${input.reason}`,
    html: renderEmailShell({ bodyHtml })
  });
}
