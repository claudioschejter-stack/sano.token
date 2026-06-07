import type { ReactNode } from 'react';

const BRAND_KEYWORD_RE = /(SANOVA\s+GLOBAL|Sanova\s+Global|\bSANOVA\b|\bSanova\b|\bRWA\b)/gi;

const gradientClass =
  'bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400 bg-clip-text text-transparent';
const glowClass = 'drop-shadow-[0_2px_8px_rgba(0,145,255,0.15)]';

type BrandGradientTextProps = {
  children: string;
  className?: string;
  /** Subtle blue glow for headings on dark backgrounds */
  glow?: boolean;
};

export function BrandGradientText({ children, className = '', glow = false }: BrandGradientTextProps) {
  const nodes: ReactNode[] = [];
  const re = new RegExp(BRAND_KEYWORD_RE.source, 'gi');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(children)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(children.slice(lastIndex, match.index));
    }

    nodes.push(
      <span
        key={`${match.index}-${match[0]}`}
        className={`${gradientClass} ${glow ? glowClass : ''}`.trim()}
      >
        {match[0]}
      </span>
    );

    lastIndex = re.lastIndex;
  }

  if (lastIndex < children.length) {
    nodes.push(children.slice(lastIndex));
  }

  if (nodes.length === 0) {
    return <>{children}</>;
  }

  return <span className={className}>{nodes}</span>;
}
