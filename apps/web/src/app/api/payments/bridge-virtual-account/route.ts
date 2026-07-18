import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { buildBridgeVirtualAccountInstructions } from '../../../../lib/checkout/bridgeVirtualAccountService';
import type {
  BridgeKycGate,
  BridgeVirtualAccountInstructions
} from '../../../../lib/checkout/paymentRouteTypes';
import { isProductionRuntime } from '../../../../lib/runtime/environment';
import {
  bridgeSourceCurrencyForCountry,
  createBridgeKycLink,
  getBridgeApiKey,
  getOrCreateBridgeCustomer,
  getOrCreateBridgeVirtualAccount,
  isBridgeCustomerReady,
  settlementHintForRails,
  type BridgeApiVirtualAccount,
  type BridgeKycLink
} from '../../../../lib/payments/bridgeClient';

function buildInstructionsFromBridgeAccount(
  account: BridgeApiVirtualAccount,
  amountUsd: number,
  referenceId: string,
  investorName: string
): BridgeVirtualAccountInstructions {
  const ins = account.source_deposit_instructions;
  const currency = (ins?.currency ?? 'usd').toUpperCase();
  const suffix = referenceId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'SANOVA';
  const accountName =
    ins?.bank_beneficiary_name ?? ins?.account_holder_name ?? investorName;
  const accountNumber =
    ins?.bank_account_number ?? ins?.account_number ?? ins?.iban ?? ins?.clabe ?? '—';
  const routingNumber = ins?.bank_routing_number ?? ins?.sort_code ?? ins?.bic ?? '—';

  return {
    bankName: ins?.bank_name ?? 'Bridge Partner Bank',
    accountName,
    accountNumber,
    routingNumber,
    swift: ins?.bic ?? (currency === 'USD' ? 'BRDGUS33' : '—'),
    beneficiaryAddress: ins?.bank_beneficiary_address ?? ins?.bank_address ?? '—',
    reference: referenceId,
    amountUsd,
    currency,
    memo: `SANOVA-${currency}-${suffix}`,
    estimatedSettlement: settlementHintForRails(ins?.payment_rails, currency),
    iban: ins?.iban,
    bic: ins?.bic,
    clabe: ins?.clabe,
    brCode: ins?.br_code,
    sortCode: ins?.sort_code,
    paymentRails: ins?.payment_rails,
    virtualAccountId: account.id
  };
}

export type BridgeVirtualAccountResponse = {
  instructions?: BridgeVirtualAccountInstructions;
  isSimulated: boolean;
  sourceCurrency?: string;
  kyc?: BridgeKycGate;
  error?: string;
};

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const referenceId = searchParams.get('referenceId') ?? 'SANOVA-REF';
  const amountUsd = Number(searchParams.get('amountUsd') ?? '0');
  const country = (searchParams.get('country') ?? 'US').toUpperCase();
  const sourceCurrency = bridgeSourceCurrencyForCountry(country);

  const session = await auth();
  const investorName = session?.user?.name?.trim() || 'SANOVA CAPITAL INVESTOR';
  const userId = session?.user?.id;
  const email = session?.user?.email;

  const apiKey = getBridgeApiKey();
  const allowSimulated = !isProductionRuntime() || process.env.BRIDGE_ALLOW_SIMULATED_VA === 'true';

  if (!apiKey) {
    if (!allowSimulated) {
      return NextResponse.json(
        { error: 'BRIDGE_NOT_CONFIGURED', isSimulated: false } satisfies BridgeVirtualAccountResponse,
        { status: 503 }
      );
    }
    const instructions = buildBridgeVirtualAccountInstructions({
      amountUsd,
      referenceId,
      investorName
    });
    return NextResponse.json({
      instructions,
      isSimulated: true,
      sourceCurrency
    } satisfies BridgeVirtualAccountResponse);
  }

  if (!userId || !email) {
    return NextResponse.json(
      { error: 'AUTH_REQUIRED', isSimulated: false } satisfies BridgeVirtualAccountResponse,
      { status: 401 }
    );
  }

  try {
    const { customer, kycLink } = await getOrCreateBridgeCustomer({
      apiKey,
      userId,
      email,
      fullName: investorName
    });

    let activeKyc: BridgeKycLink | undefined = kycLink;
    if (!isBridgeCustomerReady(customer, activeKyc)) {
      // Refresh KYC link for returning customers still pending.
      if (!activeKyc?.kyc_link) {
        activeKyc = await createBridgeKycLink({
          apiKey,
          fullName: investorName,
          email
        });
      }
      return NextResponse.json({
        isSimulated: false,
        sourceCurrency,
        kyc: {
          customerId: activeKyc.customer_id || customer.id,
          kycStatus: activeKyc.kyc_status,
          tosStatus: activeKyc.tos_status,
          kycLink: activeKyc.kyc_link ?? null,
          tosLink: activeKyc.tos_link ?? null
        }
      } satisfies BridgeVirtualAccountResponse);
    }

    const account = await getOrCreateBridgeVirtualAccount({
      apiKey,
      customerId: customer.id,
      sourceCurrency,
      referenceId
    });
    const instructions = buildInstructionsFromBridgeAccount(
      account,
      amountUsd,
      referenceId,
      investorName
    );
    return NextResponse.json({
      instructions,
      isSimulated: false,
      sourceCurrency
    } satisfies BridgeVirtualAccountResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'BRIDGE_VA_FAILED';
    if (!allowSimulated) {
      return NextResponse.json(
        { error: message, isSimulated: false, sourceCurrency } satisfies BridgeVirtualAccountResponse,
        { status: 502 }
      );
    }
    const instructions = buildBridgeVirtualAccountInstructions({
      amountUsd,
      referenceId,
      investorName
    });
    return NextResponse.json({
      instructions,
      isSimulated: true,
      sourceCurrency,
      error: message
    } satisfies BridgeVirtualAccountResponse);
  }
}
