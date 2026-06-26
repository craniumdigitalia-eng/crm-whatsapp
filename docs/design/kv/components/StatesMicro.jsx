// States: hover · focus · loading · empty · error · success
// + Microinteractions documentadas

function StatePanel({ name, mono, children, bg = '#fff' }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${T.neutralMid}`, borderRadius: 16,
      padding: 24, fontFamily: T.fontBody,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.brandPurple, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 4 }}>
        {mono}
      </div>
      <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 600, color: T.deepViolet, letterSpacing: '-0.01em', marginBottom: 16, lineHeight: 1.2 }}>
        {name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: T.surfaceLight, borderRadius: 12, minHeight: 100 }}>
        {children}
      </div>
    </div>
  );
}

function States() {
  return (
    <div style={{ padding: 40, background: T.offWhite, fontFamily: T.fontBody, minHeight: '100%' }}>
      <Eyebrow>09 — Estados</Eyebrow>
      <h2 style={{ marginTop: 12, fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', color: T.deepViolet, margin: '12px 0 32px' }}>
        Documentação dos 6 estados padrão.
      </h2>

      {/* HOVER */}
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Hover — botões, links, cards
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatePanel name="Botão primário" mono="HOVER · BG #6D28D9 + translateY(-1px)">
          <Btn variant="primary" size="md" style={{ background: T.brandPurpleHover, transform: 'translateY(-1px)', boxShadow: '0 20px 40px -8px rgba(124,58,237,0.6)' }}>
            Falar com a IA
          </Btn>
        </StatePanel>
        <StatePanel name="Link em claro" mono="HOVER · #6D28D9 + underline 1px">
          <a style={{ color: T.brandPurpleHover, textDecoration: 'underline', textDecorationThickness: 1, fontSize: 15, fontWeight: 500 }}>
            Ver demonstração completa →
          </a>
        </StatePanel>
        <StatePanel name="Card" mono="HOVER · borda A78BFA 40% + lift">
          <div style={{
            background: '#fff', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 14,
            padding: 18, transform: 'translateY(-2px)',
            boxShadow: '0 16px 32px -12px rgba(124,58,237,0.18)',
            width: '100%',
          }}>
            <div style={{ fontWeight: 600, color: T.deepViolet, fontSize: 14 }}>IA 24/7</div>
            <div style={{ fontSize: 12, color: T.fgMuted, marginTop: 4 }}>Atende lead na madrugada</div>
          </div>
        </StatePanel>
      </div>

      {/* FOCUS */}
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Focus — WCAG AA, outline 2px brand-light offset 2px
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatePanel name="Input focado" mono="FOCUS · borda + ring 4px @ 10%">
          <input value="bruno@cranium" readOnly style={{
            width: '100%', padding: '12px 16px', background: '#fff',
            border: `1px solid ${T.brandPurple}`, borderRadius: 12,
            fontFamily: T.fontBody, fontSize: 14, color: T.deepViolet, outline: 'none',
            boxShadow: '0 0 0 4px rgba(124,58,237,0.10)',
          }}/>
        </StatePanel>
        <StatePanel name="Botão focado por teclado" mono="FOCUS · outline 2px brand-light">
          <button style={{
            background: T.brandPurple, color: '#fff', border: 'none',
            padding: '13px 22px', borderRadius: 999, fontFamily: T.fontBody, fontWeight: 500, fontSize: 15,
            outline: `2px solid ${T.brandLight}`, outlineOffset: 2, cursor: 'pointer',
          }}>Falar com a IA</button>
        </StatePanel>
        <StatePanel name="Link focado" mono="FOCUS · outline 2px brand-light + offset 2px">
          <a style={{ color: T.brandPurple, fontWeight: 500, fontSize: 15, outline: `2px solid ${T.brandLight}`, outlineOffset: 4, borderRadius: 4, padding: '2px 4px' }}>
            Política de privacidade
          </a>
        </StatePanel>
      </div>

      {/* LOADING */}
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Loading — spinner, skeleton, indicador "IA digitando…"
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatePanel name="Botão enviando" mono="LOADING · spinner inline">
          <Btn variant="primary" size="md" disabled iconRight={<Icons.Loader size={16} style={{ animation: 'cd-spin 1s linear infinite' }}/>}>
            Enviando…
          </Btn>
        </StatePanel>
        <StatePanel name="Skeleton card" mono="LOADING · shimmer 1.4s">
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="cd-skeleton" style={{ height: 14, width: '80%' }}/>
            <div className="cd-skeleton" style={{ height: 14, width: '60%' }}/>
            <div className="cd-skeleton" style={{ height: 14, width: '90%' }}/>
          </div>
        </StatePanel>
        <StatePanel name="IA digitando" mono="LOADING · 3 dots pulse 1.2s" bg={T.deepViolet}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(167,139,250,0.10)', border: `1px solid ${T.borderDark}`, borderRadius: 14, color: T.brandTint, fontSize: 13 }}>
            <span style={{ display: 'inline-flex', gap: 3 }}>
              <span className="cd-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: T.brandLight, animationDelay: '0s' }}/>
              <span className="cd-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: T.brandLight, animationDelay: '0.2s' }}/>
              <span className="cd-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: T.brandLight, animationDelay: '0.4s' }}/>
            </span>
            <span style={{ fontFamily: T.fontMono, fontSize: 11 }}>IA digitando…</span>
          </div>
        </StatePanel>
      </div>

      {/* EMPTY */}
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Empty — sem resultados, lista vazia
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatePanel name="Busca sem resultados" mono="EMPTY · ícone + CTA secundário">
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 999, background: T.brandTint, color: T.brandPurple, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icons.Search size={24}/>
            </div>
            <div style={{ fontWeight: 600, color: T.deepViolet, fontSize: 15 }}>Nada encontrado</div>
            <div style={{ fontSize: 13, color: T.fgMuted, marginTop: 4, marginBottom: 12 }}>Tenta outro termo, ou pergunta direto à IA.</div>
            <Btn variant="ghost" size="sm" iconRight={<Icons.MessageSquare size={14}/>}>Falar com a IA</Btn>
          </div>
        </StatePanel>
        <StatePanel name="Inbox / dashboard vazio" mono="EMPTY · ilustração + onboarding inline">
          <div style={{ textAlign: 'center', padding: 16, width: '100%' }}>
            <Logo size={56} color={T.brandLight}/>
            <div style={{ fontWeight: 600, color: T.deepViolet, fontSize: 15, marginTop: 12 }}>Nenhum lead ainda hoje</div>
            <div style={{ fontSize: 13, color: T.fgMuted, marginTop: 4 }}>Quando chegar, você é notificado por WhatsApp.</div>
          </div>
        </StatePanel>
      </div>

      {/* ERROR + SUCCESS */}
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fgMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Error / Success — toasts inline + estado em form
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <StatePanel name="Erro (sem vermelho)" mono="ERROR · resolvido com violeta + ícone">
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value="bruno@" readOnly style={{
              padding: '12px 16px', background: '#fff',
              border: `1px solid ${T.brandPurple}`, borderRadius: 12,
              fontFamily: T.fontBody, fontSize: 14, color: T.deepViolet,
            }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.brandPurple }}>
              <Icons.AlertTriangle size={14}/> Esse e-mail não parece válido. Confere?
            </div>
          </div>
        </StatePanel>
        <StatePanel name="Sucesso" mono="SUCCESS · #10B981 + ícone">
          <div style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px', background: 'rgba(16,185,129,0.10)',
            border: '1px solid rgba(16,185,129,0.30)', borderRadius: 12,
            color: T.success, fontSize: 14, fontWeight: 500,
          }}>
            <Icons.CheckCircle size={18}/>
            Pronto. Bruno responde em até 4h.
          </div>
        </StatePanel>
      </div>
    </div>
  );
}

/* ============================================================
   MICROINTERAÇÕES — documentação visual
   ============================================================ */
function MicroPanel({ title, mono, dur, ease, children }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${T.neutralMid}`, borderRadius: 16,
      padding: 24, fontFamily: T.fontBody,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.brandPurple, fontWeight: 600, letterSpacing: '0.04em' }}>{mono}</span>
        <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.fgMuted }}>{dur} · {ease}</span>
      </div>
      <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 600, color: T.deepViolet, letterSpacing: '-0.01em', marginBottom: 16, lineHeight: 1.2 }}>
        {title}
      </div>
      <div style={{ background: T.surfaceLight, borderRadius: 12, padding: '32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140 }}>
        {children}
      </div>
    </div>
  );
}

function Microinteractions() {
  return (
    <div style={{ padding: 40, background: T.offWhite, fontFamily: T.fontBody, minHeight: '100%' }}>
      <Eyebrow>10 — Microinterações</Eyebrow>
      <h2 style={{ marginTop: 12, fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', color: T.deepViolet, margin: '12px 0 32px' }}>
        Toda animação tem duração e easing definidos.
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
        <MicroPanel title="Botão lift + glow" mono="μ01 · btn-hover" dur="180ms" ease="ease-out-quart">
          <button style={{
            background: T.brandPurple, color: '#fff', border: 'none',
            padding: '14px 24px', borderRadius: 999, fontFamily: T.fontBody, fontWeight: 500, fontSize: 15,
            cursor: 'pointer', transform: 'translateY(-1px)',
            boxShadow: '0 20px 40px -8px rgba(124,58,237,0.6)',
            transition: 'all 180ms cubic-bezier(0.22,1,0.36,1)',
          }}>Falar com a IA →</button>
        </MicroPanel>

        <MicroPanel title="Card hover lift" mono="μ02 · card-hover" dur="220ms" ease="ease-out-quart">
          <div style={{
            background: '#fff', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 14,
            padding: 20, width: 220, transform: 'translateY(-2px)',
            boxShadow: '0 16px 32px -12px rgba(124,58,237,0.22)',
            transition: 'all 220ms cubic-bezier(0.22,1,0.36,1)',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: T.brandTint, color: T.brandPurple, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Icons.Sparkles size={18}/>
            </div>
            <div style={{ fontWeight: 600, color: T.deepViolet, fontSize: 14 }}>IA treinada</div>
          </div>
        </MicroPanel>

        <MicroPanel title="IA digitando · 3 dots" mono="μ03 · ai-typing" dur="1200ms" ease="ease-in-out · loop">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: T.brandDark, border: `1px solid ${T.borderDark}`, borderRadius: 14, color: T.brandTint, fontSize: 13 }}>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              {[0,1,2].map(i => <span key={i} className="cd-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: T.brandLight, animationDelay: `${i*0.2}s` }}/>)}
            </span>
            <span style={{ fontFamily: T.fontMono, fontSize: 11 }}>IA digitando…</span>
          </div>
        </MicroPanel>

        <MicroPanel title="Status online pulse" mono="μ04 · status-pulse" dur="1200ms" ease="ease-in-out · loop">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.30)', borderRadius: 999, color: T.success, fontSize: 13, fontWeight: 500 }}>
            <span className="cd-pulse" style={{ width: 8, height: 8, borderRadius: 999, background: T.success }}/>
            Cranium IA · online 24h
          </div>
        </MicroPanel>

        <MicroPanel title="Accordion expand" mono="μ05 · accordion" dur="360ms" ease="ease-out-quart">
          <div style={{ width: '100%', background: '#fff', borderRadius: 12, border: `1px solid ${T.neutralMid}`, overflow: 'hidden' }}>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 500, color: T.deepViolet }}>A IA fala por mim?</span>
              <span style={{ width: 28, height: 28, borderRadius: 999, background: T.brandPurple, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(180deg)', transition: 'transform 360ms' }}>
                <Icons.ChevronDown size={14}/>
              </span>
            </div>
            <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${T.neutralMid}`, fontSize: 13, color: T.fgMuted, lineHeight: 1.5 }}>
              <div style={{ paddingTop: 12 }}>Não. Ela atende em nome da Cranium — você assume quando o lead esquenta.</div>
            </div>
          </div>
        </MicroPanel>

        <MicroPanel title="Stagger reveal · cards" mono="μ06 · stagger-cards" dur="320ms (+80ms/item)" ease="ease-out-quart">
          <div style={{ display: 'flex', gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 80, height: 96, borderRadius: 12,
                background: '#fff', border: `1px solid ${T.neutralMid}`,
                opacity: 1 - i * 0.25,
                transform: `translateY(${i * 4}px)`,
                display: 'flex', alignItems: 'flex-end', padding: 10,
                fontFamily: T.fontMono, fontSize: 10, color: T.fgMuted,
              }}>+{i*80}ms</div>
            ))}
          </div>
        </MicroPanel>

        <MicroPanel title="Press scale 0.98" mono="μ07 · press" dur="80ms" ease="ease-out">
          <button style={{
            background: T.brandPurple, color: '#fff', border: 'none',
            padding: '14px 24px', borderRadius: 999, fontFamily: T.fontBody, fontWeight: 500, fontSize: 15,
            cursor: 'pointer', transform: 'scale(0.98)',
            transition: 'transform 80ms ease-out',
          }}>Falar com a IA →</button>
        </MicroPanel>

        <MicroPanel title="Toast slide-in" mono="μ08 · toast" dur="320ms" ease="ease-out-quart">
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '14px 18px', background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.30)', borderRadius: 14,
            color: T.success, fontSize: 14, fontWeight: 500,
            boxShadow: '0 12px 28px -8px rgba(16,185,129,0.35)',
          }}>
            <Icons.CheckCircle size={18}/>
            Mensagem enviada. Bruno responde em 4h.
          </div>
        </MicroPanel>
      </div>
    </div>
  );
}

Object.assign(window, { States, Microinteractions });
