'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { LandingHeader } from './LandingHeader';

export function ContactPage() {
  const t = useTranslation();
  const c = t.contact;
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingHeader />

      <main className="mx-auto w-full max-w-2xl px-4 py-12 md:px-6 md:py-16">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Mail size={24} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{c.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">{c.subtitle}</p>
        </div>

        {submitted ? (
          <article className="mt-12 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <h2 className="text-xl font-bold text-emerald-900">{c.successTitle}</h2>
            <p className="mt-3 text-sm text-emerald-800">{c.successDesc}</p>
          </article>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:mt-12 md:p-8"
          >
            <div>
              <label htmlFor="contact-name" className="block text-sm font-semibold text-slate-900">
                {c.nameLabel}
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder={c.namePlaceholder}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm font-semibold text-slate-900">
                {c.emailLabel}
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={c.emailPlaceholder}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-sm font-semibold text-slate-900">
                {c.messageLabel}
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                placeholder={c.messagePlaceholder}
                className="mt-2 w-full resize-y rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              type="submit"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-blue-500 md:text-sm"
            >
              {c.submit}
              <Send size={18} />
            </button>
          </form>
        )}

        <p className="mt-10 text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-blue-600 hover:text-blue-500">
            ← {c.backHome}
          </Link>
        </p>
      </main>
    </div>
  );
}
