'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Bell,
  Eye,
  EyeOff,
  Download,
  Upload,
  Wallet,
  Building2,
  ChevronRight,
  TrendingUp,
  Search,
  ScanLine
} from 'lucide-react';
import { useTranslation, useLocale } from '../../i18n/LocaleProvider';
import { createIntlFormatters } from '../../i18n/formatters';
import type { AggregatedPortfolio } from '../../lib/portfolio/portfolioAggregator';
import { useDividendStore } from '../../store/useDividendStore';
import { translateDistributionConcept } from '../../i18n/demoLabels';

type Props = {
  portfolio: AggregatedPortfolio | null;
  displayTargetYield: number;
};

export function PwaDashboard({ portfolio, displayTargetYield }: Props) {
  const { data: session } = useSession();
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const { formatUsd: formatUsdc, formatPercent, formatDateTime } = useMemo(
    () => createIntlFormatters(intlLocale),
    [intlLocale]
  );
  
  const distributions = useDividendStore((state) => state.distributions);
  const totalCashDividendsUsdc = useDividendStore((state) => state.totalCashDividendsUsdc);

  const [showBalance, setShowBalance] = useState(true);

  const firstName = session?.user?.name?.split(' ')[0]?.toUpperCase() || 'INVERSOR';
  const totalBalance = (portfolio?.totals.totalValueUsd || 0) + totalCashDividendsUsdc;

  useEffect(() => {
    document.body.classList.add('pwa-dashboard-active');
    return () => document.body.classList.remove('pwa-dashboard-active');
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 pb-24 font-sans -mx-4 -mt-[4.5rem]">
      {/* HEADER (Trustworthy Blue) */}
      <div className="bg-blue-600 px-4 pb-16 pt-safe-top">
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white font-bold">
              {firstName.charAt(0)}
            </div>
            <span className="text-lg font-medium text-white">Hola, {firstName}</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white">
              <Search size={20} />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white relative">
              <Bell size={20} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="mt-6 flex gap-6 text-sm font-medium text-white/80 overflow-x-auto hide-scrollbar">
          <button className="text-white border-b-2 border-white pb-1 whitespace-nowrap">Total</button>
          <button className="whitespace-nowrap">USDC</button>
          <button className="whitespace-nowrap">RWA</button>
          <button className="whitespace-nowrap">Préstamos</button>
        </div>
      </div>

      {/* MAIN CARD (Overlaps header) */}
      <div className="px-4 -mt-12">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-900">Tu dinero</span>
            <Link href="/dashboard/wallet" className="text-slate-400">
              <ChevronRight size={20} />
            </Link>
          </div>
          
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-3xl font-bold text-slate-900">
              {showBalance ? formatUsdc(totalBalance) : '***'}
            </h2>
            <button onClick={() => setShowBalance(!showBalance)} className="text-blue-600">
              {showBalance ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </div>

          <div className="mt-1 flex items-center gap-1 text-sm font-medium text-emerald-600">
            <TrendingUp size={14} />
            <span>Rinde {formatPercent(displayTargetYield / 100)} APY</span>
          </div>

          {/* QUICK ACTIONS */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Link href="/dashboard/wallet" className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-blue-50/50 py-4 transition-colors active:bg-blue-50">
              <div className="flex text-blue-600">
                <Download size={24} strokeWidth={1.5} />
              </div>
              <span className="text-xs font-medium text-blue-900">Ingresar</span>
            </Link>
            <Link href="/dashboard/wallet" className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-blue-50/50 py-4 transition-colors active:bg-blue-50">
              <div className="flex text-blue-600">
                <Upload size={24} strokeWidth={1.5} />
              </div>
              <span className="text-xs font-medium text-blue-900">Retirar</span>
            </Link>
            <Link href="/dashboard/wallet" className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-blue-50/50 py-4 transition-colors active:bg-blue-50">
              <div className="flex text-blue-600">
                <Wallet size={24} strokeWidth={1.5} />
              </div>
              <span className="text-xs font-medium text-blue-900">Tu alias</span>
            </Link>
          </div>
        </div>
      </div>

      {/* SUGERENCIAS (Properties) */}
      <div className="mt-8">
        <div className="px-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Sugerencias</h3>
        </div>
        
        <div className="mt-4 flex gap-4 overflow-x-auto px-4 pb-4 snap-x hide-scrollbar">
          {/* Mock Property Card 1 */}
          <Link href="/marketplace" className="min-w-[280px] snap-start rounded-3xl bg-slate-800 p-6 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-sky-500/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <h4 className="font-bold text-white text-xl">Vaca Muerta RWA</h4>
              <p className="mt-2 text-sm text-slate-300">Invierte en Real Estate tokenizado desde 50 USDC.</p>
              <div className="mt-6 flex items-center gap-2">
                <span className="text-sm font-medium text-white">Invertir ahora</span>
                <ChevronRight size={16} className="text-white" />
              </div>
            </div>
          </Link>

          {/* Mock Property Card 2 */}
          <Link href="/marketplace" className="min-w-[280px] snap-start rounded-3xl bg-blue-600 p-6 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <h4 className="font-bold text-white text-xl">Añelo Infraestructura</h4>
              <p className="mt-2 text-sm text-blue-100">Rentas mensuales en USDC directo a tu wallet.</p>
              <div className="mt-6 flex items-center gap-2">
                <span className="text-sm font-medium text-white">Conocer más</span>
                <ChevronRight size={16} className="text-white" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* ACTIVITY */}
      <div className="mt-4 px-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Últimas actividades</h3>
          <Link href="/dashboard/cash-flow" className="text-sm font-medium text-blue-600">Consultar todas <ChevronRight size={14} className="inline" /></Link>
        </div>

        <div className="mt-4 rounded-3xl bg-white shadow-sm overflow-hidden">
          {distributions.slice(0, 3).map((dist, idx) => (
            <div key={dist.id} className={`flex items-center gap-4 p-4 ${idx !== 0 ? 'border-t border-slate-100' : ''}`}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-600">
                <TrendingUp size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {translateDistributionConcept(dist.concept, t.demoLabels)}
                </p>
                <p className="text-sm text-slate-500">Dinero disponible</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-emerald-600">+{formatUsdc(dist.amountUsdc)}</p>
                <p className="text-xs text-slate-400">{formatDateTime(dist.date).split(',')[0]}</p>
              </div>
            </div>
          ))}
          {distributions.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">
              Aún no tienes actividad reciente.
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM NAVIGATION (App-like) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white pb-safe">
        <div className="flex h-[4.5rem] items-center justify-around px-2">
          <Link href="/dashboard" className="flex flex-col items-center justify-center gap-1 w-16 text-blue-600">
            <Building2 size={24} />
            <span className="text-[10px] font-medium">Inicio</span>
          </Link>
          <Link href="/marketplace" className="flex flex-col items-center justify-center gap-1 w-16 text-slate-400 hover:text-slate-600">
            <Wallet size={24} />
            <span className="text-[10px] font-medium">Invertir</span>
          </Link>
          
          {/* Center Action Button (Like QR in MP) */}
          <div className="relative -top-5 flex flex-col items-center justify-center w-16">
            <Link href="/marketplace" className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 ring-4 ring-slate-100">
              <ScanLine size={28} />
            </Link>
          </div>

          <Link href="/dashboard/cash-flow" className="flex flex-col items-center justify-center gap-1 w-16 text-slate-400 hover:text-slate-600">
            <TrendingUp size={24} />
            <span className="text-[10px] font-medium">Rentas</span>
          </Link>
          <Link href="/dashboard/settings" className="flex flex-col items-center justify-center gap-1 w-16 text-slate-400 hover:text-slate-600">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
              {firstName.charAt(0)}
            </div>
            <span className="text-[10px] font-medium">Perfil</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
