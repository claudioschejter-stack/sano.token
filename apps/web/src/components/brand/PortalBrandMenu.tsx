import Link from 'next/link';

type PortalBrandMenuProps = {
  href?: string;
  className?: string;
  onNavigate?: () => void;
};

const MENU_LINES = [
  { text: 'Sanova Global', className: 'text-sm font-semibold tracking-tight text-slate-900' },
  { text: 'SANOVAGLOBAL', className: 'text-xs font-black tracking-[0.18em] text-slate-900' },
  { text: 'RWA', className: 'text-xs font-black tracking-widest text-slate-900' },
  { text: 'Portal RWA', className: 'text-xs font-medium text-slate-600' }
] as const;

export function PortalBrandMenu({ href = '/', className = '', onNavigate }: PortalBrandMenuProps) {
  const content = (
    <div
      className={`rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 ${className}`.trim()}
    >
      <div className="flex flex-col gap-0.5">
        {MENU_LINES.map((line) => (
          <p key={line.text} className={line.className}>
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} onClick={onNavigate} className="block transition-opacity hover:opacity-90">
      {content}
    </Link>
  );
}
