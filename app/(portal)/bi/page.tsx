import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Métricas & BI — Cranium Digital',
};

// Story 5.6 — módulo de métricas e BI
export default function BiPage() {
  return (
    <section className="placeholder-section">
      <div className="placeholder-content">
        <div className="placeholder-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <h2>Métricas &amp; BI</h2>
        <p>Em desenvolvimento — Story 5.6</p>
      </div>
    </section>
  );
}
