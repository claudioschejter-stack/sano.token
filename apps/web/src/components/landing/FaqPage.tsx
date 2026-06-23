'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LandingHeader } from './LandingHeader';

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: '¿Qué es un token RWA?',
    answer:
      'Un token RWA (Real World Asset) es una representación digital de un activo real —como infraestructura energética o inmuebles— en una blockchain. En Sanova Global, los tokens representan cuotapartes del Fideicomiso Sanova Global RWA, con subyacente en proyectos de Vaca Muerta.'
  },
  {
    question: '¿Cómo funciona la tokenización en Sanova?',
    answer:
      'Sanova emite tokens ERC-4626 sobre la red Base (blockchain de Ethereum). Cada token representa una participación proporcional en el patrimonio del fideicomiso. Los inversores reciben rendimientos en USDC directamente en su wallet, de forma automática y transparente.'
  },
  {
    question: '¿Es legal invertir en Sanova desde Argentina?',
    answer:
      'Sí. Sanova Global SAS opera bajo el fideicomiso Sanova Global RWA, enmarcado en la Ley 24.441 de Argentina. Es una colocación privada de cuotapartes fiduciarias; no constituye oferta pública de valores negociables ni requiere registro ante la CNV (Ley 26.831, art. 2).'
  },
  {
    question: '¿Puedo invertir desde el exterior?',
    answer:
      'Sí. Aceptamos inversores de más de 15 países. El proceso de KYC es 100% digital. Los pagos se pueden realizar con tarjeta, transferencia bancaria (wire) o directamente en USDC sobre Base. Los rendimientos se distribuyen en USDC a tu wallet Privy.'
  },
  {
    question: '¿Cuál es el monto mínimo de inversión?',
    answer:
      'El monto mínimo varía según el compartimento. Consultá el marketplace para ver las condiciones vigentes de cada proyecto. En general, buscamos que la inversión sea accesible a partir de montos bajos para democratizar el acceso a activos institucionales.'
  },
  {
    question: '¿Cómo recibo los rendimientos?',
    answer:
      'Los rendimientos se distribuyen en USDC sobre la red Base directamente a tu wallet Privy (embedded wallet). No necesitás gestionar claves privadas; Privy las protege con cifrado MPC. Podés retirar los USDC a cualquier wallet externa en cualquier momento.'
  },
  {
    question: '¿Qué es Vaca Muerta y por qué invertir ahí?',
    answer:
      'Vaca Muerta es la segunda mayor reserva de gas no convencional y la cuarta de petróleo del mundo, ubicada en Neuquén, Argentina. Con más de 30.000 km² de extensión, es una de las formaciones shale más productivas del hemisferio sur, con décadas de potencial de extracción.'
  },
  {
    question: '¿Cuáles son los riesgos de invertir en tokens RWA?',
    answer:
      'Como toda inversión, existen riesgos: volatilidad del precio del petróleo/gas, riesgo regulatorio, riesgo operacional del fideicomiso, y riesgo de liquidez (los tokens son instrumentos privados). Te recomendamos leer los Términos Legales antes de invertir y consultar con un asesor financiero.'
  },
  {
    question: '¿Cómo hago el KYC?',
    answer:
      'El proceso de verificación de identidad (KYC) es 100% digital y tarda menos de 10 minutos. Necesitás documento de identidad vigente y una selfie. Una vez aprobado, quedás en la whitelist del fideicomiso y podés comenzar a invertir.'
  },
  {
    question: '¿Puedo vender mis tokens?',
    answer:
      'Los tokens de Sanova son instrumentos de colocación privada con mercado secundario habilitado dentro de la plataforma. Podés ofrecer tus posiciones a otros inversores verificados. La liquidez depende de la demanda del mercado secundario en cada momento.'
  }
];

function FaqAccordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="font-medium text-slate-900">{item.question}</span>
        {open ? (
          <ChevronUp size={18} className="shrink-0 text-slate-400" />
        ) : (
          <ChevronDown size={18} className="shrink-0 text-slate-400" />
        )}
      </button>
      {open ? (
        <div className="pb-5 pr-8 text-sm leading-relaxed text-slate-600">{item.answer}</div>
      ) : null}
    </div>
  );
}

export function FaqPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <main className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-24">
        {/* Hero */}
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Preguntas frecuentes
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            FAQ
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Todo lo que necesitás saber sobre la inversión en activos tokenizados con Sanova Global.
          </p>
        </div>

        {/* Accordion */}
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-6">
          {FAQ_ITEMS.map((item) => (
            <FaqAccordion key={item.question} item={item} />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl bg-slate-50 p-8 text-center">
          <p className="text-slate-700">¿No encontraste lo que buscabas?</p>
          <Link
            href="/contacto"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Contactanos
          </Link>
        </div>
      </main>
    </div>
  );
}
