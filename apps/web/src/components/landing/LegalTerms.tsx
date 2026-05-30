'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Scale } from 'lucide-react';
import { getLegalTerms, type LegalTermsSection } from '../../content/legalTerms';
import { useLocale } from '../../i18n/LocaleProvider';
import { LandingHeader } from './LandingHeader';

function renderInlineMarkdown(text: string) {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const segments: Array<{ type: 'text' | 'link'; value: string; href?: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'link', value: match[1], href: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', value: text });
  }

  return segments.flatMap((segment, segmentIndex) => {
    if (segment.type === 'link' && segment.href) {
      const isInternal = segment.href.startsWith('/');
      if (isInternal) {
        return (
          <Link
            key={`link-${segmentIndex}`}
            href={segment.href}
            className="font-semibold text-blue-600 underline-offset-2 hover:underline"
          >
            {segment.value}
          </Link>
        );
      }
      return (
        <a
          key={`link-${segmentIndex}`}
          href={segment.href}
          className="font-semibold text-blue-600 underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {segment.value}
        </a>
      );
    }

    const parts = segment.value.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      const key = `${segmentIndex}-${index}`;
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        if (inner.includes('@')) {
          return (
            <a
              key={key}
              href={`mailto:${inner}`}
              className="font-semibold text-blue-600 underline-offset-2 hover:underline"
            >
              {inner}
            </a>
          );
        }
        return (
          <strong key={key} className="font-semibold text-slate-900">
            {inner}
          </strong>
        );
      }
      return part;
    });
  });
}

function LegalParagraph({ text }: { text: string }) {
  return <p className="mt-4 leading-relaxed text-slate-700">{renderInlineMarkdown(text)}</p>;
}

function SectionBody({ section }: { section: LegalTermsSection }) {
  return (
    <div className="border-t border-slate-100 px-5 pb-6 pt-4 md:px-6">
      {section.paragraphs?.map((paragraph) => (
        <LegalParagraph key={paragraph.slice(0, 48)} text={paragraph} />
      ))}

      {section.bullets ? (
        <ul className="mt-4 list-disc space-y-3 pl-5 text-slate-700">
          {section.bullets.map((item) => (
            <li key={item.slice(0, 48)} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      ) : null}

      {section.orderedBullets ? (
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-slate-700">
          {section.orderedBullets.map((item) => (
            <li key={item.slice(0, 48)} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function LegalTerms() {
  const { locale } = useLocale();
  const doc = getLegalTerms(locale);
  const sectionIds = useMemo(() => doc.sections.map((section) => section.id), [doc.sections]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(doc.sections.map((section, index) => [section.id, index === 0]))
  );
  const [activeSection, setActiveSection] = useState(sectionIds[0] ?? '');

  const toggleSection = useCallback((id: string) => {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const scrollToSection = useCallback((id: string) => {
    setOpenSections((current) => ({ ...current, [id]: true }));
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(id);
            }
          });
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0.1 }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => observers.forEach((observer) => observer.disconnect());
  }, [sectionIds]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Scale size={24} aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{doc.title}</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">{doc.subtitle}</p>
          <p className="mt-3 text-sm text-slate-500">
            {doc.lastUpdatedLabel} {doc.lastUpdated}
          </p>
        </header>

        <div className="mt-10 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
          <aside className="mb-8 lg:mb-0">
            <nav
              aria-label={doc.indexTitle}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{doc.indexTitle}</p>
              <ul className="mt-3 space-y-1">
                {doc.sections.map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm leading-snug transition-colors ${
                          isActive
                            ? 'bg-slate-900 font-medium text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {section.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <Link
                  href="/privacidad"
                  className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline"
                >
                  {doc.privacyLinkLabel}
                </Link>
              </div>
            </nav>
          </aside>

          <article className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              {doc.intro.split('\n\n').map((paragraph) => (
                <LegalParagraph key={paragraph.slice(0, 48)} text={paragraph} />
              ))}
            </div>

            {doc.sections.map((section) => {
              const isOpen = openSections[section.id] ?? false;
              return (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`panel-${section.id}`}
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left md:px-6"
                  >
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 md:text-xl">{section.title}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">{section.summary}</p>
                    </div>
                    <ChevronDown
                      size={20}
                      aria-hidden
                      className={`mt-1 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isOpen ? (
                    <div id={`panel-${section.id}`}>
                      <SectionBody section={section} />
                    </div>
                  ) : null}
                </section>
              );
            })}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              {doc.closingNote.split('\n\n').map((paragraph) => {
                const isItalic = paragraph.startsWith('*') && paragraph.endsWith('*');
                const content = isItalic ? paragraph.slice(1, -1) : paragraph;
                return (
                  <p
                    key={paragraph.slice(0, 48)}
                    className={`mt-4 leading-relaxed first:mt-0 ${isItalic ? 'text-sm italic text-slate-600' : 'text-slate-700'}`}
                  >
                    {renderInlineMarkdown(content)}
                  </p>
                );
              })}
            </div>
          </article>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {doc.backHome}
          </Link>
          <Link
            href="/privacidad"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {doc.privacyLinkLabel}
          </Link>
        </div>
      </main>
    </div>
  );
}
