'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Shield,
  User,
  Wallet,
  XCircle,
  Building2,
  Settings,
  Copy
} from 'lucide-react';
import { AdminGate } from './AdminGate';
import type {
  AccountAuditUser,
  PlatformConfig,
  RegistrationAttemptRow
} from '../../app/api/admin/account-audit/route';

type AuditData = {
  ok: boolean;
  query: string | null;
  summary: {
    total: number;
    byRole: Record<string, number>;
    withRealWallet: number;
    withPlaceholderWallet: number;
    withNoWallet: number;
    needingWalletProvisioning: number;
    kycApproved: number;
    kycPending: number;
    withPassword: number;
    suspended: number;
    failedRegistrationAttempts: number;
  };
  platformConfig: PlatformConfig;
  accounts: AccountAuditUser[];
  registrationAttempts: RegistrationAttemptRow[];
  auditedAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  TREASURY: 'Tesorería',
  OPERATOR: 'Operador',
  ADVISOR_MANAGER: 'Asesor Manager',
  ADVISOR: 'Asesor',
  INVESTOR: 'Inversor'
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'text-red-400 border-red-400/30 bg-red-400/10',
  TREASURY: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  OPERATOR: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  ADVISOR_MANAGER: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
  ADVISOR: 'text-indigo-400 border-indigo-400/30 bg-indigo-400/10',
  INVESTOR: 'text-green-400 border-green-400/30 bg-green-400/10'
};

const KYC_COLORS: Record<string, string> = {
  APPROVED: 'text-terminal-success border-terminal-success/30',
  PENDING: 'text-terminal-warning border-terminal-warning/30',
  REJECTED: 'text-terminal-danger border-terminal-danger/30',
  NOT_STARTED: 'text-terminal-muted border-terminal-border'
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role] ?? 'text-terminal-muted border-terminal-border'}`}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function KycBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${KYC_COLORS[status] ?? 'text-terminal-muted border-terminal-border'}`}
    >
      {status}
    </span>
  );
}

function WalletBadge({ status, address }: { status: string; address?: string | null }) {
  const short = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  if (status === 'REAL') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-terminal-success">
        <CheckCircle className="h-3 w-3" />
        {short ?? 'Vinculada'}
      </span>
    );
  }

  if (status === 'PENDING_PLACEHOLDER') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-terminal-warning">
        <AlertTriangle className="h-3 w-3" />
        Pendiente (placeholder)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-terminal-muted">
      <XCircle className="h-3 w-3" />
      Sin wallet
    </span>
  );
}

function ConfigRow({ label, ok, value }: { label: string; ok: boolean; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-terminal-border/30 last:border-0">
      <span className="text-sm text-terminal-muted">{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-xs font-mono text-terminal-dim truncate max-w-xs">{value}</span>}
        {ok ? (
          <CheckCircle className="h-4 w-4 text-terminal-success flex-shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-terminal-danger flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

export function AdminAccountAuditView() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'accounts' | 'attempts'>('accounts');
  const [copied, setCopied] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  const load = useCallback(async (query = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const trimmed = query.trim();
      if (trimmed) {
        params.set('q', trimmed);
      }
      const res = await fetch(`/api/admin/account-audit?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      setData(json as AuditData);
      setAppliedQuery(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar auditoría');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load('');
  }, []);

  const copyAddress = (addr: string) => {
    void navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  };

  const backfillWallets = async () => {
    setBackfilling(true);
    setBackfillMessage(null);
    try {
      const res = await fetch('/api/admin/account-audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      setBackfillMessage(`Wallets generadas: ${json.linked} de ${json.processed} cuenta(s) procesada(s).`);
      await load(appliedQuery);
    } catch (e) {
      setBackfillMessage(e instanceof Error ? `Error: ${e.message}` : 'Error al generar wallets');
    } finally {
      setBackfilling(false);
    }
  };

  const filteredAccounts = data?.accounts.filter(
    (u) => roleFilter === 'ALL' || u.systemRole === roleFilter
  ) ?? [];

  return (
    <AdminGate>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-terminal-bright flex items-center gap-2">
              <Shield className="h-5 w-5 text-terminal-primary" />
              Auditoría de Cuentas del Sistema
            </h1>
            {data?.auditedAt && (
              <p className="text-xs text-terminal-muted mt-1">
                Última actualización: {new Date(data.auditedAt).toLocaleString('es-AR')}
              </p>
            )}
          </div>
          <button
            onClick={() => void load(searchQuery)}
            disabled={loading}
            className="flex items-center gap-2 rounded-md border border-terminal-border px-3 py-1.5 text-sm text-terminal-dim hover:text-terminal-bright hover:border-terminal-primary/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void load(searchQuery);
              }
            }}
            placeholder="Buscar por nombre, email o teléfono (ej. bragadin)"
            className="w-full rounded-md border border-terminal-border bg-terminal-surface px-3 py-2 text-sm text-terminal-bright placeholder:text-terminal-muted"
          />
          <button
            onClick={() => void load(searchQuery)}
            disabled={loading}
            className="rounded-md border border-terminal-primary/40 bg-terminal-primary/10 px-4 py-2 text-sm font-medium text-terminal-primary hover:bg-terminal-primary/20 disabled:opacity-50"
          >
            Buscar
          </button>
        </div>

        {appliedQuery ? (
          <p className="text-xs text-terminal-muted">
            Filtro activo: <span className="font-mono text-terminal-primary">{appliedQuery}</span>
          </p>
        ) : null}

        {error && (
          <div className="rounded-md border border-terminal-danger/30 bg-terminal-danger/10 p-3 text-sm text-terminal-danger">
            {error}
          </div>
        )}

        {data && !data.platformConfig.investorOpenRegistration ? (
          <div className="rounded-md border border-terminal-warning/30 bg-terminal-warning/10 p-3 text-sm text-terminal-warning">
            Registro de inversores cerrado: se exige invitación válida para altas nuevas.
          </div>
        ) : null}

        {data && data.platformConfig.investorOpenRegistration ? (
          <div className="rounded-md border border-terminal-success/30 bg-terminal-success/10 p-3 text-sm text-terminal-success">
            Registro abierto: ON — la invitación es opcional (marketing/atribución). Los errores{' '}
            <span className="font-mono">INVALID_INVITE_CODE</span> no deberían aparecer en altas nuevas.
          </div>
        ) : null}

        {data && !data.platformConfig.turnstileKeysInSync ? (
          <div className="rounded-md border border-terminal-warning/30 bg-terminal-warning/10 p-3 text-sm text-terminal-warning">
            Turnstile está parcialmente configurado: el secret del servidor y la site key del cliente deben
            estar ambos activos o ambos ausentes. Un mismatch bloquea registros nuevos con CAPTCHA_INVALIDO.
          </div>
        ) : null}

        {data && appliedQuery && activeTab === 'accounts' && filteredAccounts.some((u) => u.hasPassword) ? (
          <div className="rounded-md border border-terminal-primary/30 bg-terminal-primary/10 p-3 text-sm text-terminal-primary">
            Una o más cuentas encontradas ya tienen contraseña. Si el usuario intentó registrarse de nuevo,
            debe usar <span className="font-mono">/acceso/olvidar</span> para recuperar acceso, no crear otra cuenta.
          </div>
        ) : null}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-terminal-border bg-terminal-surface p-3 text-center">
                <p className="text-2xl font-bold text-terminal-bright">{data.summary.total}</p>
                <p className="text-xs text-terminal-muted mt-0.5">Total usuarios</p>
              </div>
              <div className="rounded-lg border border-terminal-success/30 bg-terminal-success/5 p-3 text-center">
                <p className="text-2xl font-bold text-terminal-success">{data.summary.withRealWallet}</p>
                <p className="text-xs text-terminal-muted mt-0.5">Con wallet real</p>
              </div>
              <div className="rounded-lg border border-terminal-warning/30 bg-terminal-warning/5 p-3 text-center">
                <p className="text-2xl font-bold text-terminal-warning">{data.summary.withPlaceholderWallet}</p>
                <p className="text-xs text-terminal-muted mt-0.5">Wallet pendiente</p>
              </div>
              <div className="rounded-lg border border-terminal-danger/30 bg-terminal-danger/5 p-3 text-center">
                <p className="text-2xl font-bold text-terminal-danger">{data.summary.needingWalletProvisioning}</p>
                <p className="text-xs text-terminal-muted mt-0.5">Necesitan wallet</p>
              </div>
              <div className="rounded-lg border border-terminal-primary/30 bg-terminal-primary/5 p-3 text-center">
                <p className="text-2xl font-bold text-terminal-primary">{data.summary.kycApproved}</p>
                <p className="text-xs text-terminal-muted mt-0.5">KYC aprobado</p>
              </div>
              <div className="rounded-lg border border-terminal-border bg-terminal-surface p-3 text-center">
                <p className="text-2xl font-bold text-terminal-warning">{data.summary.kycPending}</p>
                <p className="text-xs text-terminal-muted mt-0.5">KYC pendiente</p>
              </div>
              <div className="rounded-lg border border-terminal-border bg-terminal-surface p-3 text-center">
                <p className="text-2xl font-bold text-terminal-bright">{data.summary.withPassword}</p>
                <p className="text-xs text-terminal-muted mt-0.5">Con contraseña</p>
              </div>
              <div className="rounded-lg border border-terminal-danger/30 bg-terminal-danger/5 p-3 text-center">
                <p className="text-2xl font-bold text-terminal-danger">{data.summary.failedRegistrationAttempts}</p>
                <p className="text-xs text-terminal-muted mt-0.5">Registros fallidos</p>
              </div>
            </div>

            {/* Platform Config */}
            <div className="rounded-lg border border-terminal-border bg-terminal-surface p-4">
              <h2 className="flex items-center gap-2 text-sm font-medium text-terminal-bright mb-3">
                <Settings className="h-4 w-4" />
                Configuración de Plataforma
              </h2>
              <div className="grid gap-0 sm:grid-cols-2">
                <div className="sm:pr-4">
                  <p className="text-xs text-terminal-muted font-medium mb-2 uppercase tracking-wide">Admin & Auth</p>
                  <ConfigRow
                    label="Registro inversores abierto"
                    ok={data.platformConfig.investorOpenRegistration}
                    value={data.platformConfig.investorOpenRegistration ? 'ON (sin invite obligatorio)' : 'OFF'}
                  />
                  <ConfigRow
                    label="AUTH_ADMIN_EMAILS"
                    ok={data.platformConfig.adminEmails.startsWith('✓')}
                    value={data.platformConfig.adminEmails}
                  />
                  <ConfigRow
                    label="Privy App ID"
                    ok={data.platformConfig.privyAppId}
                    value={data.platformConfig.privyAppId ? 'Configurado' : undefined}
                  />
                  <ConfigRow
                    label="Privy Embedded Wallets"
                    ok={data.platformConfig.privyEmbeddedWalletEnabled}
                    value="createOnLogin: users-without-wallets"
                  />
                  <ConfigRow
                    label="Turnstile secret (server)"
                    ok={data.platformConfig.turnstileSecretConfigured}
                    value={data.platformConfig.turnstileSecretConfigured ? 'Configurado' : 'No configurado'}
                  />
                  <ConfigRow
                    label="Turnstile site key (client)"
                    ok={data.platformConfig.turnstileSiteKeyConfigured}
                    value={data.platformConfig.turnstileSiteKeyConfigured ? 'Configurado' : 'No configurado'}
                  />
                  <ConfigRow
                    label="Turnstile keys sincronizadas"
                    ok={data.platformConfig.turnstileKeysInSync}
                    value={
                      data.platformConfig.turnstileKeysInSync
                        ? 'Secret y site key alineados'
                        : 'Mismatch: uno configurado y el otro no'
                    }
                  />
                </div>
                <div className="sm:pl-4 sm:border-l sm:border-terminal-border/30 mt-3 sm:mt-0">
                  <p className="text-xs text-terminal-muted font-medium mb-2 uppercase tracking-wide">Wallets de Plataforma</p>
                  <ConfigRow
                    label="Treasury (USDC / Base)"
                    ok={Boolean(data.platformConfig.treasuryAddress)}
                    value={
                      data.platformConfig.treasuryAddress
                        ? `${data.platformConfig.treasuryAddress.slice(0, 8)}…${data.platformConfig.treasuryAddress.slice(-6)}`
                        : 'NO CONFIGURADO'
                    }
                  />
                  <ConfigRow
                    label="RWA Operator Address"
                    ok={Boolean(data.platformConfig.operatorAddress)}
                    value={
                      data.platformConfig.operatorAddress
                        ? `${data.platformConfig.operatorAddress.slice(0, 8)}…${data.platformConfig.operatorAddress.slice(-6)}`
                        : 'NO CONFIGURADO'
                    }
                  />
                  <ConfigRow label="Privy Treasury Wallet ID" ok={data.platformConfig.privyTreasuryWalletId} />
                  <ConfigRow label="Privy Operator Wallet ID" ok={data.platformConfig.privyOperatorWalletId} />
                  <ConfigRow label="Privy Safe Owner Wallet ID" ok={data.platformConfig.privySafeOwnerWalletId} />
                  <ConfigRow
                    label="Operador on-chain activo"
                    ok={data.platformConfig.isPrivyOperatorConfigured}
                    value={data.platformConfig.isPrivyOperatorConfigured ? 'Privy signer listo' : 'Sin signer configurado'}
                  />
                </div>
              </div>
            </div>

            {/* Roles summary */}
            <div className="rounded-lg border border-terminal-border bg-terminal-surface p-4">
              <h2 className="flex items-center gap-2 text-sm font-medium text-terminal-bright mb-3">
                <User className="h-4 w-4" />
                Usuarios por Rol
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRoleFilter('ALL')}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${roleFilter === 'ALL' ? 'border-terminal-primary text-terminal-primary bg-terminal-primary/10' : 'border-terminal-border text-terminal-muted hover:border-terminal-primary/50'}`}
                >
                  Todos ({data.summary.total})
                </button>
                {Object.entries(data.summary.byRole).map(([role, count]) => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${roleFilter === role ? 'border-terminal-primary text-terminal-primary bg-terminal-primary/10' : 'border-terminal-border text-terminal-muted hover:border-terminal-primary/50'}`}
                  >
                    {ROLE_LABELS[role] ?? role} ({count})
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('accounts')}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === 'accounts'
                    ? 'border-terminal-primary text-terminal-primary bg-terminal-primary/10'
                    : 'border-terminal-border text-terminal-muted hover:border-terminal-primary/50'
                }`}
              >
                Cuentas ({filteredAccounts.length})
              </button>
              <button
                onClick={() => setActiveTab('attempts')}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === 'attempts'
                    ? 'border-terminal-primary text-terminal-primary bg-terminal-primary/10'
                    : 'border-terminal-border text-terminal-muted hover:border-terminal-primary/50'
                }`}
              >
                Intentos de registro ({data.registrationAttempts.length})
              </button>
            </div>

            {activeTab === 'accounts' ? (
            <div className="space-y-6">
            <div className="rounded-lg border border-terminal-border bg-terminal-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-terminal-border/50 bg-terminal-surface/50">
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Usuario</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Cuenta</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Rol</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">KYC</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Verificación</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Wallet Usuario</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Wallet Inversión</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-terminal-border/20">
                    {filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-terminal-muted text-sm">
                          No hay usuarios con este filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map((u) => (
                        <tr
                          key={u.id}
                          className={`hover:bg-terminal-surface/70 transition-colors ${u.needsWalletProvisioning ? 'bg-terminal-warning/5' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-terminal-bright text-xs">{u.email}</p>
                            {u.name && <p className="text-xs text-terminal-muted mt-0.5">{u.name}</p>}
                            {u.phone ? <p className="text-xs text-terminal-dim mt-0.5">{u.phone}</p> : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1 text-xs">
                              <span className={u.hasPassword ? 'text-terminal-success' : 'text-terminal-warning'}>
                                {u.hasPassword ? '✓ Contraseña' : '○ Sin contraseña'}
                              </span>
                              <span className="text-terminal-muted">{u.accountStatus}</span>
                              <span className={u.investorAccessEnabled ? 'text-terminal-success' : 'text-terminal-muted'}>
                                {u.investorAccessEnabled ? 'Acceso inversor' : 'Sin acceso inversor'}
                              </span>
                              <span className="text-terminal-dim">
                                {new Date(u.updatedAt).toLocaleString('es-AR')}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <RoleBadge role={u.systemRole} />
                          </td>
                          <td className="px-4 py-3">
                            <KycBadge status={u.kycStatus} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className={`text-xs ${u.emailVerified ? 'text-terminal-success' : 'text-terminal-muted'}`}>
                                {u.emailVerified ? '✓' : '○'} Email
                              </span>
                              <span className={`text-xs ${u.phoneVerified ? 'text-terminal-success' : 'text-terminal-muted'}`}>
                                {u.phoneVerified ? '✓' : '○'} Teléfono
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <WalletBadge
                                status={u.walletStatus}
                                address={u.walletStatus === 'REAL' ? u.walletAddress : null}
                              />
                              {u.walletStatus === 'REAL' && u.walletAddress && (
                                <button
                                  onClick={() => copyAddress(u.walletAddress!)}
                                  className="text-terminal-muted hover:text-terminal-bright transition-colors"
                                  title="Copiar dirección"
                                >
                                  {copied === u.walletAddress ? (
                                    <CheckCircle className="h-3 w-3 text-terminal-success" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <WalletBadge
                                status={u.investorProfile?.walletStatus ?? 'NONE'}
                                address={
                                  u.investorProfile?.walletStatus === 'REAL'
                                    ? u.investorProfile.walletAddress
                                    : null
                                }
                              />
                              {u.investorProfile?.walletStatus === 'REAL' && u.investorProfile.walletAddress && (
                                <button
                                  onClick={() => copyAddress(u.investorProfile!.walletAddress)}
                                  className="text-terminal-muted hover:text-terminal-bright transition-colors"
                                  title="Copiar dirección"
                                >
                                  {copied === u.investorProfile.walletAddress ? (
                                    <CheckCircle className="h-3 w-3 text-terminal-success" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {u.needsWalletProvisioning ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-terminal-warning/30 bg-terminal-warning/10 px-2 py-0.5 text-xs text-terminal-warning">
                                <AlertTriangle className="h-3 w-3" />
                                Necesita wallet
                              </span>
                            ) : u.hasLinkedWallet ? (
                              <span className="inline-flex items-center gap-1 text-xs text-terminal-success">
                                <CheckCircle className="h-3 w-3" />
                                OK
                              </span>
                            ) : (
                              <span className="text-xs text-terminal-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {data.summary.needingWalletProvisioning > 0 && (
              <div className="rounded-lg border border-terminal-warning/30 bg-terminal-warning/5 p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-terminal-warning mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Inversores KYC aprobados sin wallet vinculada ({data.summary.needingWalletProvisioning})
                </h3>
                <p className="text-xs text-terminal-muted leading-relaxed">
                  Estos inversores tienen KYC aprobado pero nunca se generó su wallet embebida de Privy. Desde
                  ahora esto se resuelve automáticamente al aprobar el KYC (pre-generación server-side), pero para
                  las cuentas que quedaron atrás antes de ese cambio, generalas manualmente acá:
                </p>
                <button
                  onClick={() => void backfillWallets()}
                  disabled={backfilling}
                  className="mt-3 flex items-center gap-2 rounded-md border border-terminal-warning/40 bg-terminal-warning/10 px-3 py-1.5 text-xs font-medium text-terminal-warning hover:bg-terminal-warning/20 disabled:opacity-50"
                >
                  <Wallet className={`h-3.5 w-3.5 ${backfilling ? 'animate-pulse' : ''}`} />
                  {backfilling ? 'Generando wallets…' : 'Generar wallets Privy ahora'}
                </button>
                {backfillMessage && (
                  <p className="mt-2 text-xs text-terminal-bright">{backfillMessage}</p>
                )}
              </div>
            )}
            </div>
            ) : (
            <div className="rounded-lg border border-terminal-border bg-terminal-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-terminal-border/50 bg-terminal-surface/50">
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Email</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Resultado</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Error</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">Canal</th>
                      <th className="px-4 py-3 text-left text-xs text-terminal-muted font-medium">País IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-terminal-border/20">
                    {data.registrationAttempts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-terminal-muted text-sm">
                          No hay intentos de registro registrados todavía.
                        </td>
                      </tr>
                    ) : (
                      data.registrationAttempts.map((attempt) => (
                        <tr key={attempt.id} className="hover:bg-terminal-surface/70 transition-colors">
                          <td className="px-4 py-3 text-xs text-terminal-dim">
                            {new Date(attempt.createdAt).toLocaleString('es-AR')}
                          </td>
                          <td className="px-4 py-3 text-xs text-terminal-bright">{attempt.email}</td>
                          <td className="px-4 py-3">
                            {attempt.success ? (
                              <span className="text-xs text-terminal-success">OK</span>
                            ) : (
                              <span className="text-xs text-terminal-danger">Falló</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-terminal-warning">
                            {attempt.errorCode ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-terminal-muted">{attempt.channel ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-terminal-muted">{attempt.ipCountry ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Treasury info */}
            <div className="rounded-lg border border-terminal-border bg-terminal-surface p-4">
              <h2 className="flex items-center gap-2 text-sm font-medium text-terminal-bright mb-3">
                <Building2 className="h-4 w-4" />
                Cuentas de Tesorería y Operación
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs text-terminal-muted font-medium uppercase tracking-wide">Admin</p>
                  <p className="text-xs text-terminal-dim">
                    Rol asignado vía <code className="text-terminal-primary">AUTH_ADMIN_EMAILS</code> en Vercel.
                    El usuario debe iniciar sesión para que el rol se propague al JWT.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-terminal-muted font-medium uppercase tracking-wide">Tesorería USDC</p>
                  {data.platformConfig.treasuryAddress ? (
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-mono text-terminal-primary break-all">
                        {data.platformConfig.treasuryAddress}
                      </p>
                      <button onClick={() => copyAddress(data.platformConfig.treasuryAddress!)} className="text-terminal-muted hover:text-terminal-bright flex-shrink-0">
                        {copied === data.platformConfig.treasuryAddress ? <CheckCircle className="h-3 w-3 text-terminal-success" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-terminal-danger">BASE_STABLECOIN_TREASURY_ADDRESS no configurado</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-terminal-muted font-medium uppercase tracking-wide">Operador RWA</p>
                  {data.platformConfig.operatorAddress ? (
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-mono text-terminal-primary break-all">
                        {data.platformConfig.operatorAddress}
                      </p>
                      <button onClick={() => copyAddress(data.platformConfig.operatorAddress!)} className="text-terminal-muted hover:text-terminal-bright flex-shrink-0">
                        {copied === data.platformConfig.operatorAddress ? <CheckCircle className="h-3 w-3 text-terminal-success" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-terminal-danger">RWA_OPERATOR_ADDRESS no configurado</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-terminal-muted" />
          </div>
        )}
      </div>
    </AdminGate>
  );
}
