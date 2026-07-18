'use client';

import { ExternalLink, Landmark, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';

type Currency = 'usd' | 'eur' | 'mxn';

type Props = {
  onLinked?: () => void;
};

export function BridgeExternalAccountForm({ onLinked }: Props) {
  const t = useTranslation();
  const lw = t.linkedWallets;
  const [currency, setCurrency] = useState<Currency>('usd');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kyc, setKyc] = useState<{
    kycLink: string | null;
    tosLink: string | null;
    kycStatus: string;
    tosStatus: string;
  } | null>(null);

  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [ibanCountry, setIbanCountry] = useState('IRL');
  const [clabe, setClabe] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('USA');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setKyc(null);

    const address = {
      streetLine1: street.trim(),
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
      country: country.trim()
    };

    let body: Record<string, unknown>;
    if (currency === 'usd') {
      body = {
        currency: 'usd',
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        accountOwnerName: ownerName.trim() || `${firstName} ${lastName}`.trim(),
        routingNumber: routingNumber.trim(),
        accountNumber: accountNumber.trim(),
        checkingOrSavings: 'checking',
        address: { ...address, country: address.country || 'USA' }
      };
    } else if (currency === 'eur') {
      body = {
        currency: 'eur',
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        accountOwnerName: ownerName.trim() || `${firstName} ${lastName}`.trim(),
        iban: iban.trim(),
        bic: bic.trim(),
        ibanCountry: ibanCountry.trim() || 'IRL',
        address: { ...address, country: address.country || 'IRL' }
      };
    } else {
      body = {
        currency: 'mxn',
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        accountOwnerName: ownerName.trim() || `${firstName} ${lastName}`.trim(),
        clabe: clabe.trim(),
        address: { ...address, country: address.country || 'MEX' }
      };
    }

    try {
      const response = await fetch('/api/wallet/bridge-external-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reason?: string;
        error?: string;
        kyc?: {
          kycLink: string | null;
          tosLink: string | null;
          kycStatus: string;
          tosStatus: string;
        };
      } | null;

      if (response.status === 409 && data?.kyc) {
        setKyc(data.kyc);
        setError(lw.bridgeKycRequired);
        return;
      }

      if (!response.ok || !data?.ok) {
        setError(data?.error ?? lw.bridgeLinkError);
        return;
      }

      onLinked?.();
    } catch {
      setError(lw.bridgeLinkError);
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-400';

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <Landmark size={16} className="text-slate-500" />
        <p className="text-sm font-semibold text-slate-800">{lw.bridgeLinkTitle}</p>
      </div>
      <p className="text-xs text-slate-500">{lw.bridgeLinkDesc}</p>

      <label className="block text-xs font-medium text-slate-600">
        {lw.bridgeCurrency}
        <select
          value={currency}
          onChange={(e) => {
            const next = e.target.value as Currency;
            setCurrency(next);
            setCountry(next === 'usd' ? 'USA' : next === 'eur' ? 'IRL' : 'MEX');
          }}
          className={inputClass}
        >
          <option value="usd">USD (ACH)</option>
          <option value="eur">EUR (IBAN)</option>
          <option value="mxn">MXN (CLABE)</option>
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          {lw.bridgeBankName}
          <input required value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {lw.bridgeAccountName}
          <input required value={accountName} onChange={(e) => setAccountName(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {lw.bridgeFirstName}
          <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {lw.bridgeLastName}
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
        </label>
      </div>

      {currency === 'usd' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600">
            {lw.bridgeRouting}
            <input required value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {lw.bridgeAccountNumber}
            <input required value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={inputClass} />
          </label>
        </div>
      ) : null}

      {currency === 'eur' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600">
            IBAN
            <input required value={iban} onChange={(e) => setIban(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            BIC
            <input required value={bic} onChange={(e) => setBic(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {lw.bridgeIbanCountry}
            <input required value={ibanCountry} onChange={(e) => setIbanCountry(e.target.value)} className={inputClass} />
          </label>
        </div>
      ) : null}

      {currency === 'mxn' ? (
        <label className="block text-xs font-medium text-slate-600">
          CLABE
          <input required value={clabe} onChange={(e) => setClabe(e.target.value)} className={inputClass} />
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
          {lw.bridgeStreet}
          <input required value={street} onChange={(e) => setStreet(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {lw.bridgeCity}
          <input required value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {lw.bridgeState}
          <input value={state} onChange={(e) => setState(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {lw.bridgePostal}
          <input required value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {lw.bridgeCountry}
          <input required value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className="block text-xs font-medium text-slate-600">
        {lw.bridgeOwnerName}
        <input
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder={`${firstName} ${lastName}`.trim()}
          className={inputClass}
        />
      </label>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {kyc ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {kyc.tosLink ? (
            <a
              href={kyc.tosLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
            >
              <ExternalLink size={12} />
              {lw.bridgeTosCta}
            </a>
          ) : null}
          {kyc.kycLink ? (
            <a
              href={kyc.kycLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
            >
              <ExternalLink size={12} />
              {lw.bridgeKycCta}
            </a>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {busy ? lw.bridgeLinking : lw.bridgeLinkCta}
      </button>
    </form>
  );
}
