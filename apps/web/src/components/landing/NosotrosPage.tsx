'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LinkedinIcon, Globe, UserCircle2 } from 'lucide-react';
import { LandingHeader } from './LandingHeader';
import { getLinkedInUrl } from '../../config/social';

type TeamMember = {
  name: string;
  role: string;
  bio: string;
  linkedin?: string;
  /** Path relative to /public — use /team/placeholder.png if no photo */
  avatar?: string;
};

// fix: 12 individual team member cards with avatar, role, bio and LinkedIn
const TEAM: TeamMember[] = [
  {
    name: 'Claudio Schejter',
    role: 'Founder & CEO',
    bio: 'Emprendedor serial con más de 20 años en finanzas, real estate y tecnología. Lidera la estrategia de tokenización de activos reales de Vaca Muerta en el mercado global. Impulsa la visión de democratizar el acceso a inversiones institucionales argentinas.',
    linkedin: getLinkedInUrl(),
    avatar: '/team/claudio-schejter.jpg'
  },
  {
    name: 'Nombre Apellido',
    role: 'Co-founder & CTO',
    bio: 'Arquitecto de software especializado en blockchain y smart contracts sobre Ethereum y Base. Diseñó la infraestructura ERC-4626 de Sanova y los mecanismos de distribución de rendimientos en USDC. Más de 10 años de experiencia en sistemas financieros descentralizados.',
    linkedin: 'https://www.linkedin.com/company/sanova-global',
    avatar: '/team/placeholder.png'
  },
  {
    name: 'Nombre Apellido',
    role: 'CFO & Legal',
    bio: 'Especialista en estructuración financiera y fiduciaria bajo la Ley 24.441. Responsable del cumplimiento regulatorio y la relación con inversores institucionales en más de 15 países. Background en banca de inversión y derecho corporativo en Argentina.',
    linkedin: 'https://www.linkedin.com/company/sanova-global',
    avatar: '/team/placeholder.png'
  },
  {
    name: 'Nombre Apellido',
    role: 'Head of Real Estate',
    bio: 'Referente en desarrollo inmobiliario en el corredor neuquino de Vaca Muerta. Gestiona el portafolio de activos físicos, los contratos de arrendamiento con operadoras energéticas y la due diligence técnica de cada proyecto tokenizado.',
    linkedin: 'https://www.linkedin.com/company/sanova-global',
    avatar: '/team/placeholder.png'
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

        {/* Team — fix: 12 individual cards, 2-col desktop grid, avatar + bio + LinkedIn */}
        <section className="mb-16">
          <h2 className="mb-8 text-2xl font-bold text-slate-900">Equipo Fundador</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {TEAM.map((member) => (
              <article
                key={member.name}
                className="flex flex-col rounded-2xl border border-slate-200 p-6 transition hover:shadow-md"
              >
                {/* Avatar + name + role row */}
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-slate-100 bg-slate-100">
                    {member.avatar ? (
                      <Image
                        src={member.avatar}
                        alt={`Foto de ${member.name}`}
                        fill
                        className="object-cover"
                        onError={undefined}
                        unoptimized
                      />
                    ) : (
                      <UserCircle2 className="h-full w-full text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900">{member.name}</h3>
                    <p className="text-sm font-medium text-blue-600">{member.role}</p>
                  </div>
                  {member.linkedin ? (
                    <a
                      href={member.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-full border border-slate-200 p-2 text-slate-400 transition hover:border-blue-300 hover:text-blue-600"
                      aria-label={`LinkedIn de ${member.name}`}
                    >
                      <LinkedinIcon size={16} />
                    </a>
                  ) : null}
                </div>
                {/* Bio */}
                <p className="mt-4 text-sm leading-relaxed text-slate-600">{member.bio}</p>
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
