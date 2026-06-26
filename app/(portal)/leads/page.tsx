import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leads — Cranium Digital',
};

// Story 5.5 — módulo de leads completo
export default function LeadsPage() {
  return (
    <section className="placeholder-section">
      <div className="placeholder-content">
        <div className="placeholder-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h2>Leads</h2>
        <p>Em desenvolvimento — Story 5.5</p>
      </div>
    </section>
  );
}
