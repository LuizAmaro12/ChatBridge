export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand${compact ? ' brand-compact' : ''}`}>
    <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M11 11h18v13H18l-7 5V11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M16 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>
    <span>TalkToMe<span className="brand-dot">.</span></span>
  </div>;
}
