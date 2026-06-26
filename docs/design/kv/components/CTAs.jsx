// 5 CTA patterns — banner, split, card flutuante, sticky bar, inline

/* 1. BANNER full-bleed dark */
function CTA_Banner() {
  return (
    <section style={{ background: T.deepViolet, padding: '80px 0', fontFamily: T.fontBody, position: 'relative', overflow: 'hidden' }}>
      <NeuralBG opacity={0.18}/>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 30% 50%, rgba(124,58,237,0.25), transparent 50%)`, pointerEvents: 'none' }}/>
      <Container max={1280} style={{ position: 'relative', textAlign: 'center' }}>
        <Eyebrow dark>Pronto pra ter estrutura?</Eyebrow>
        <h2 style={{
          marginTop: 20, fontFamily: T.fontDisplay, fontWeight: 600,
          fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 1.05, letterSpacing: '-0.025em',
          color: T.brandTint, textWrap: 'balance',
        }}>
          A próxima fase da sua<br/>
          corretora não é sozinha.
        </h2>
        <p style={{ marginTop: 20, fontSize: 18, color: T.neutralSoft, maxWidth: 580, marginLeft: 'auto', marginRight: 'auto' }}>
          Diagnóstico em 30min. Roteiro escrito de 90 dias. Sem follow-up agressivo.
        </p>
        <div style={{ marginTop: 36, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn variant="primary" size="lg" iconRight={<Icons.ArrowRight size={18}/>}>Agendar diagnóstico</Btn>
          <Btn variant="secondaryDark" size="lg" icon={<Icons.Calendar size={16}/>}>Ver cases</Btn>
        </div>
      </Container>
    </section>
  );
}

/* 2. SPLIT (copy + form mini) */
function CTA_Split() {
  return (
    <section style={{ background: T.offWhite, padding: '80px 0', fontFamily: T.fontBody }}>
      <Container max={1280}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 56, alignItems: 'center',
          background: '#fff', borderRadius: 24, border: `1px solid ${T.neutralMid}`,
          padding: 56, boxShadow: '0 24px 64px -24px rgba(124,58,237,0.18)',
        }}>
          <div>
            <Eyebrow>Material gratuito</Eyebrow>
            <h2 style={{
              marginTop: 16, fontFamily: T.fontDisplay, fontWeight: 600,
              fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em',
              color: T.deepViolet, textWrap: 'balance',
            }}>
              Playbook: a <span style={{ color: T.brandPurple }}>estrutura online</span> mínima de uma corretora que cresce.
            </h2>
            <p style={{ marginTop: 16, fontSize: 16, color: T.fgMuted, lineHeight: 1.6 }}>
              PDF de 18 páginas com o checklist de tráfego, conteúdo, CRM e site. O que a Cranium implementa nos primeiros 30 dias.
            </p>
            <ul style={{ marginTop: 24, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Checklist de tráfego (Meta + Google)', 'Calendário editorial de autoridade', 'Setup mínimo de CRM e follow-up'].map(it => (
                <li key={it} style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.fgMuted, fontSize: 14 }}>
                  <Icons.Check size={16} style={{ color: T.brandPurple }}/>{it}
                </li>
              ))}
            </ul>
          </div>
          <div style={{
            background: T.brandTint, borderRadius: 20, padding: 32,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{
              padding: '6px 12px', borderRadius: 999,
              background: '#fff', border: `1px solid ${T.brandLight}`,
              alignSelf: 'flex-start',
              fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase',
              color: T.brandPurple,
            }}>Download gratuito</div>
            <input placeholder="Seu nome" style={inpStyle}/>
            <input placeholder="seu@email.com.br" type="email" style={inpStyle}/>
            <input placeholder="(11) 99999-9999" style={inpStyle}/>
            <Btn variant="primary" size="md" fullWidth iconRight={<Icons.Download size={16}/>}>
              Baixar PDF agora
            </Btn>
            <div style={{ fontSize: 11, color: T.fgMuted, lineHeight: 1.5, marginTop: 4 }}>
              Ao baixar, você concorda em receber 1 e-mail/semana com conteúdo de corretor pra corretor. Sair quando quiser.
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
const inpStyle = {
  width: '100%', padding: '12px 16px', borderRadius: 999,
  border: `1px solid ${T.neutralMid}`, background: '#fff',
  fontFamily: T.fontBody, fontSize: 14, color: T.deepViolet,
  outline: 'none',
};

/* 3. CARD FLUTUANTE (gradient) */
function CTA_FloatingCard() {
  return (
    <section style={{ background: T.surfaceLight, padding: '60px 0', fontFamily: T.fontBody }}>
      <Container max={1080}>
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: `linear-gradient(135deg, ${T.deepViolet} 0%, #3D1B6E 60%, ${T.brandPurple} 100%)`,
          borderRadius: 28, padding: '52px 56px',
          color: T.brandTint,
          boxShadow: '0 32px 80px -16px rgba(124,58,237,0.45)',
        }}>
          <NeuralBG opacity={0.12} lines={false}/>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 560 }}>
              <Eyebrow dark color={T.brandTint}>15 minutos · sem compromisso</Eyebrow>
              <h2 style={{
                marginTop: 16, fontFamily: T.fontDisplay, fontWeight: 600,
                fontSize: 'clamp(28px, 3.2vw, 44px)', lineHeight: 1.05, letterSpacing: '-0.02em',
                color: T.brandTint, margin: 0, textWrap: 'balance',
              }}>
                Você fala com o Bruno.<br/>
                <span style={{ opacity: 0.7 }}>Não com SDR genérico.</span>
              </h2>
            </div>
            <Btn variant="primary" size="lg" iconRight={<Icons.ArrowRight size={18}/>} style={{ background: '#fff', color: T.deepViolet, boxShadow: 'none' }}>
              Agendar com o Bruno
            </Btn>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* 4. STICKY BAR (top of page) */
function CTA_StickyBar() {
  return (
    <div style={{
      background: T.brandPurple, color: '#fff', padding: '12px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      fontFamily: T.fontBody, fontSize: 14, flexWrap: 'wrap',
      boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: T.success }} className="cd-pulse"/>
      <strong style={{ fontWeight: 600 }}>Promo · março</strong>
      <span style={{ opacity: 0.85 }}>setup grátis pros primeiros 10 corretores · até 31/03</span>
      <a href="#" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        Aproveitar <Icons.ArrowRight size={14}/>
      </a>
      <button style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7, marginLeft: 8 }}>
        <Icons.X size={16}/>
      </button>
    </div>
  );
}

/* 5. INLINE (entre parágrafos) */
function CTA_Inline() {
  return (
    <section style={{ background: T.offWhite, padding: '60px 0', fontFamily: T.fontBody }}>
      <Container max={720}>
        <p style={{ fontSize: 17, lineHeight: 1.75, color: T.fgMuted, marginBottom: 32 }}>
          (Conteúdo de blog post anterior…) Lead que chega 23h47 e demora 4h pra ter resposta vira lead frio. O custo dessa demora é matematicamente impossível de compensar — quanto mais você corre, mais lead bom escapa.
        </p>
        <div style={{
          background: T.brandTint,
          border: `1px solid rgba(124,58,237,0.2)`,
          borderRadius: 20, padding: 32,
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: T.brandPurple, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icons.Sparkles size={26}/>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 600, color: T.deepViolet, letterSpacing: '-0.01em' }}>
              Pergunta certa: você tem IA pra esse momento?
            </div>
            <div style={{ fontSize: 14, color: T.fgMuted, marginTop: 4 }}>
              Veja em 90 segundos como a Cranium atende lead às 23h47.
            </div>
          </div>
          <Btn variant="primary" size="md" iconRight={<Icons.Play size={14}/>}>Ver demo</Btn>
        </div>
        <p style={{ fontSize: 17, lineHeight: 1.75, color: T.fgMuted, marginTop: 32 }}>
          (Continua o conteúdo do post…) A Cranium foi desenhada exatamente pra esse buraco — pelo Bruno, que viveu o problema vendendo plano por 6 anos.
        </p>
      </Container>
    </section>
  );
}

function CTAs() {
  const list = [
    { n: 1, name: 'Banner full-bleed dark',  comp: CTA_Banner },
    { n: 2, name: 'Split + form mini',        comp: CTA_Split },
    { n: 3, name: 'Card flutuante gradient',  comp: CTA_FloatingCard },
    { n: 4, name: 'Sticky bar (top)',         comp: CTA_StickyBar },
    { n: 5, name: 'Inline (mid-content)',     comp: CTA_Inline },
  ];
  return (
    <div style={{ background: '#f0eee9', display: 'flex', flexDirection: 'column' }}>
      {list.map(s => (
        <div key={s.n}>
          <div style={{ padding: '24px 40px 16px', background: '#f0eee9', fontFamily: T.fontBody, display: 'flex', alignItems: 'baseline', gap: 16, borderBottom: '1px dashed rgba(124,58,237,0.18)' }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 13, color: T.brandPurple, fontWeight: 600 }}>CTA {String(s.n).padStart(2, '0')}</span>
            <span style={{ fontWeight: 600, color: T.deepViolet, fontSize: 16 }}>{s.name}</span>
          </div>
          <s.comp/>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { CTA_Banner, CTA_Split, CTA_FloatingCard, CTA_StickyBar, CTA_Inline, CTAs });
