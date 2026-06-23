'use client';

import Link from 'next/link';
import { LinkedinIcon, Globe } from 'lucide-react';
import { LandingHeader } from './LandingHeader';
import { getLinkedInUrl } from '../../config/social';

type TeamMember = {
  name: string;
  role: string;
  bio: string;
  linkedin?: string;
};

const TEAM: TeamMember[] = [
  {
    name: 'Equipo Fundador',
    role: 'Sanova Global SAS',
    bio: 'Sanova Global SAS es una empresa argentina especializada en la tokenización de activos reales del sector energético de Vaca Muerta, Neuquén. Combinamos infraestructura blockchain con la Ley de Fideicomiso argentina para ofrecer inversiones fraccionadas, globales y transparentes.',
    linkedin: getLinkedInUrl()
  }
];

export function NosotrosPage() {
  const linkedInUrl = getLinkedInUrl();

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <main className="mx-auto max-w-4xl px-4 py-16 md:px-6 md:py-24">
        {/* Hero */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Nosotros
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            El equipo detrás de Sanova
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Sanova Global SAS nació con la misión de democratizar el acceso a activos reales de alta calidad a través de tecnología blockchain. Tokenizamos infraestructura energética en Vaca Muerta para inversores globales.
          </p>
        </div>

        {/* Mission */}
        <section className="mb-16 rounded-2xl bg-slate-50 p-8 md:p-12">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">Nuestra misión</h2>
          <p className="text-lg leading-relaxed text-slate-700">
            Conectar a inversores de todo el mundo con los activos reales más atractivos de Argentina. Utilizamos el estándar ERC-4626 sobre Base blockchain y el fideicomiso Sanova Global RWA para garantizar transparencia, liquidez y seguridad regulatoria bajo la Ley 24.441.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { label: 'Fundación', value: '2024' },
              { label: 'País', value: 'Argentina' },
              { label: 'Sede', value: 'Neuquén, Patagonia' }
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-2xl font-bold text-blue-600">{item.value}</p>
                <p className="mt-1 text-sm text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section className="mb-16">
          <h2 className="mb-8 text-2xl font-bold text-slate-900">Equipo</h2>
          <div className="grid gap-8 sm:grid-cols-1">
            {TEAM.map((member) => (
              <article
                key={member.name}
                className="rounded-2xl border border-slate-200 p-8"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{member.name}</h3>
                    <p className="mt-1 text-sm font-medium text-blue-600">{member.role}</p>
                  </div>
                  {member.linkedin ? (
                    <a
                      href={member.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-blue-300 hover:text-blue-600"
                      aria-label={`LinkedIn de ${member.name}`}
                    >
                      <LinkedinIcon size={18} />
                    </a>
                  ) : null}
                </div>
                <p className="mt-4 leading-relaxed text-slate-600">{member.bio}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Values */}
        <section className="mb-16">
          <h2 className="mb-8 text-2xl font-bold text-slate-900">Nuestros valores</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                title: 'Transparencia',
                desc: 'Todos los activos son auditables on-chain. Las distribuciones en USDC son verificables en tiempo real.'
              },
              {
                title: 'Seguridad regulatoria',
                desc: 'Operamos bajo el fideicomiso Sanova Global RWA, enmarcado en la Ley 24.441. Colocación privada de cuotapartes fiduciarias.'
              },
              {
                title: 'Acceso global',
                desc: 'Inversores de 15+ países acceden a activos argentinos que antes eran exclusivos de grandes fondos institucionales.'
              },
              {
                title: 'Tecnología de vanguardia',
                desc: 'ERC-4626 sobre Base blockchain garantiza liquidez, interoperabilidad y rendimientos distribuibles en USDC.'
              }
            ].map((v) => (
              <div key={v.title} className="rounded-xl border border-slate-100 bg-slate-50 p-6">
                <h3 className="mb-2 font-semibold text-slate-900">{v.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl bg-slate-900 p-8 text-center md:p-12">
          <h2 className="text-2xl font-bold text-white">¿Querés saber más?</h2>
          <p className="mt-3 text-slate-400">
            Seguinos en LinkedIn o visitá el marketplace para conocer nuestros proyectos.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href={linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              <LinkedinIcon size={16} />
              LinkedIn
            </a>
            <Link
              href="/contacto"
              className="inline-flex items-center gap-2 rounded-full border border-slate-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-slate-400"
            >
              <Globe size={16} />
              Contacto
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
