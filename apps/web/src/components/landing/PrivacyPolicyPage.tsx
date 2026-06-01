'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { getPrivacyPolicy } from '../../content/privacyPolicy';
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
        return (
          <strong key={key} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
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

export function PrivacyPolicyPage() {
  const { locale } = useLocale();
  const doc = getPrivacyPolicy(locale);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-12 md:px-6 md:py-16">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Shield size={24} aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{doc.title}</h1>
          <p className="mt-3 text-sm text-slate-500">
            {doc.lastUpdatedLabel} {doc.lastUpdated}
          </p>
        </div>

        <article className="prose prose-slate mt-10 max-w-none rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          {doc.intro.split('\n\n').map((paragraph) => (
            <LegalParagraph key={paragraph.slice(0, 48)} text={paragraph} />
          ))}

          {doc.sections.map((section) => (
            <section key={section.title} className="mt-10 border-t border-slate-100 pt-8 first:mt-8 first:border-t-0 first:pt-0">
              <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>

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
            </section>
          ))}

          <div className="mt-10 border-t border-slate-100 pt-8">
            {doc.arcoNote.split('\n\n').map((paragraph) => {
              const isItalic = paragraph.startsWith('*') && paragraph.endsWith('*');
              const content = isItalic ? paragraph.slice(1, -1) : paragraph;
              return (
                <p
                  key={paragraph.slice(0, 48)}
                  className={`mt-4 leading-relaxed ${isItalic ? 'text-sm italic text-slate-600' : 'text-slate-700'}`}
                >
                  {renderInlineMarkdown(content)}
                </p>
              );
            })}
          </div>
        </article>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {doc.backHome}
          </Link>
        </div>
      </main>
    </div>
  );
}
