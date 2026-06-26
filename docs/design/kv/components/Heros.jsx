// 5 Heros — variações conceituais
// 1. Split + Chat IA preview  (PRIMÁRIO recomendado · meta — produto vendendo a si mesmo)
// 2. Centrado + numerais grandes (autoridade, stat-driven)
// 3. Editorial split com foto do Bruno (autoridade humana, SUSEP)
// 4. Terminal/code dark (vibe técnica AI/dev)
// 5. Provocação editorial (pergunta gigante "quantos leads você perdeu...")

/* ============================================================
   Hero shared bits — Pill "agência especializada"
   ============================================================ */
function FounderPill({ dark = true }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '6px 14px 6px 8px', borderRadius: 999,
      background: dark ? 'rgba(167,139,250,0.10)' : 'rgba(124,58,237,0.06)',
      border: `1px solid ${dark ? 'rgba(167,139,250,0.25)' : 'rgba(124,58,237,0.18)'}`,
      color: dark ? T.brandLight : T.brandPurple,
      fontFamily: T.fontBody, fontSize: 12, fontWeight: 500,
      letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, background: T.brandPurple, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <Icons.ShieldCheck size={11}/>
      </span>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: T.success, marginRight: 2 }} className="cd-pulse" />
      Especializada em corretoras · SUSEP ativa
    </div>
  );
}

/* ============================================================
   Dashboard preview — pilares rodando (substitui o chat IA no Hero1)
   ============================================================ */
function HeroDashboard() {
  const pilares = [
    { ico: <Icons.Target size={14}/>,      l: 'Tráfego pago',       k: 'CPL',       v: 'R$ 18',  d: '↓ 32% mês',  pct: 78 },
    { ico: <Icons.Award size={14}/>,       l: 'Autoridade',          k: 'Alcance',   v: '127K',   d: '+ 4.2x',     pct: 64 },
    { ico: <Icons.TrendingUp size={14}/>,  l: 'Comercial',           k: 'Conversão', v: '22%',    d: '+ 14 pp',    pct: 88 },
    { ico: <Icons.Globe size={14}/>,       l: 'Estrutura online',    k: 'Uptime',    v: '99.9%',  d: 'estável',     pct: 96 },
  ];
  return (
    <div style={{
      background: T.brandDark,
      border: `1px solid ${T.borderDark}`,
      borderRadius: 24,
      padding: 24,
      boxShadow: '0 32px 64px -16px rgba(124,58,237,0.5), 0 0 0 1px rgba(167,139,250,0.08)',
      fontFamily: T.fontBody,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        paddingBottom: 16, marginBottom: 18,
        borderBottom: `1px solid ${T.borderDark}`,
      }}>
        <Logo size={32} color={T.brandLight} />
        <div style={{ flex: 1 }}>
          <div style={{ color: T.brandTint, fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em' }}>Corretora Saúde+ · painel</div>
          <div style={{ color: T.brandLight, fontSize: 11, fontFamily: T.fontMono }}>operação · março/2026</div>
        </div>
        <div style={{
          fontSize: 10, color: T.success, letterSpacing: '0.10em',
          textTransform: 'uppercase', fontWeight: 500,
          padding: '4px 10px', borderRadius: 999,
          border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span className="cd-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: T.success }}/>
          ao vivo
        </div>
      </div>

      {/* Big metric */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, color: T.brandLight, letterSpacing: '0.10em', textTransform: 'uppercase' }}>Leads qualificados · 30 dias</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
          <span className="cd-tnum" style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 56, color: T.brandTint, letterSpacing: '-0.03em', lineHeight: 1 }}>847</span>
          <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.success, fontWeight: 500 }}>↑ +312% YoY</span>
        </div>
      </div>

      {/* Pilares grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pilares.map((p, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center',
            padding: '12px 14px',
            background: 'rgba(167,139,250,0.06)',
            border: `1px solid ${T.borderDark}`,
            borderRadius: 12,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(124,58,237,0.25)', color: T.brandLight,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{p.ico}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: T.brandTint, fontWeight: 500 }}>{p.l}</div>
              <div style={{
                marginTop: 6, height: 3, background: 'rgba(167,139,250,0.12)', borderRadius: 999, overflow: 'hidden',
              }}>
                <div style={{ width: `${p.pct}%`, height: '100%', background: T.brandLight, borderRadius: 999 }}/>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="cd-tnum" style={{ fontFamily: T.fontMono, fontSize: 14, color: T.brandTint, fontWeight: 600 }}>{p.v}</div>
              <div style={{ fontSize: 10, color: p.d.startsWith('↓') || p.d.startsWith('+') ? T.success : T.brandLight, fontFamily: T.fontMono }}>{p.d}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 14, padding: '10px 14px',
        background: 'rgba(124,58,237,0.18)',
        border: '1px dashed rgba(167,139,250,0.45)',
        borderRadius: 10,
        fontSize: 12, color: T.brandTint,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Icons.Sparkles size={14} style={{ color: T.brandLight }}/>
        <span style={{ flex: 1 }}>Roteiro do próximo trimestre <strong style={{ color: T.brandLight }}>pronto</strong></span>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.brandLight }}>ver →</span>
      </div>
    </div>
  );
}

/* ============================================================
   HERO 1 — SPLIT + CHAT (RECOMENDADO)
   ============================================================ */
function Hero1_Split() {
  return (
    <section style={{
      position: 'relative', background: T.deepViolet,
      padding: '88px 0 100px', overflow: 'hidden',
      fontFamily: T.fontBody,
    }}>
      <NeuralBG opacity={0.22}/>
      {/* radial vignette */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 70% 30%, rgba(124,58,237,0.18), transparent 55%)`, pointerEvents: 'none' }} />

      <Container max={1280} style={{ position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <FounderPill/>
            <h1 style={{
              fontFamily: T.fontDisplay, fontWeight: 600,
              fontSize: 'clamp(48px, 5.5vw, 80px)',
              lineHeight: 1.02, letterSpacing: '-0.025em',
              color: T.brandTint, margin: '24px 0 24px',
              textWrap: 'balance',
            }}>
              Tráfego que vira lead.<br/>
              <span style={{ color: T.brandLight }}>Autoridade que vira venda.</span>
            </h1>

            <p style={{
              fontFamily: T.fontBody, fontSize: 20, lineHeight: 1.5,
              color: T.neutralSoft, maxWidth: 560, margin: '0 0 36px',
              textWrap: 'pretty',
            }}>
              A agência especializada em corretoras de seguros que constrói toda a estrutura online — tráfego pago, posicionamento de autoridade e operação comercial — pra escalar em nível nacional.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 36 }}>
              <Btn variant="primary" size="lg" iconRight={<Icons.ArrowRight size={18}/>}>
                Agendar diagnóstico
              </Btn>
              <Btn variant="secondaryDark" size="lg" icon={<Icons.Play size={14}/>}>
                Ver cases · 90s
              </Btn>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: T.fontBody }}>
              <div style={{ display: 'flex' }}>
                {['#7C3AED', '#A78BFA', '#5B21B6', '#EDE9FE'].map((c, i) => (
                  <div key={i} style={{
                    width: 32, height: 32, borderRadius: 999, background: c,
                    border: `2px solid ${T.deepViolet}`, marginLeft: i ? -10 : 0,
                  }}/>
                ))}
              </div>
              <div>
                <div style={{ color: T.brandTint, fontSize: 14, fontWeight: 500 }}>
                  Corretoras de seguros em <span className="cd-tnum">14</span> estados
                </div>
                <div style={{ color: T.brandLight, fontSize: 12, fontFamily: T.fontMono }}>
                  operação nacional · SUSEP ativa
                </div>
              </div>
            </div>
          </div>

          <HeroDashboard />
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   HERO 2 — CENTRADO + NUMERAIS GIGANTES
   ============================================================ */
function Hero2_Centered() {
  return (
    <section style={{
      position: 'relative', background: T.deepViolet,
      padding: '120px 0 80px', overflow: 'hidden', fontFamily: T.fontBody,
    }}>
      <NeuralBG opacity={0.18} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 0%, rgba(124,58,237,0.22), transparent 50%)`, pointerEvents: 'none' }} />

      <Container max={1100} style={{ position: 'relative', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: 32 }}>
          <FounderPill/>
        </div>

        <h1 style={{
          fontFamily: T.fontDisplay, fontWeight: 600,
          fontSize: 'clamp(56px, 7vw, 112px)',
          lineHeight: 0.96, letterSpacing: '-0.035em',
          color: T.brandTint, margin: '0 0 8px',
          textWrap: 'balance',
        }}>
          A agência que estrutura<br/>
          <span style={{ color: T.brandLight }}>corretora de seguros.</span>
        </h1>

        <p style={{
          fontFamily: T.fontBody, fontSize: 22, lineHeight: 1.45,
          color: T.neutralSoft, maxWidth: 720, margin: '32px auto 40px',
          textWrap: 'pretty',
        }}>
          Tráfego pago, posicionamento de autoridade e estruturação comercial.<br/>
          A operação online completa pra crescer em escala nacional.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 80 }}>
          <Btn variant="primary" size="lg" iconRight={<Icons.ArrowRight size={18}/>}>Agendar diagnóstico</Btn>
          <Btn variant="secondaryDark" size="lg" icon={<Icons.Calendar size={16}/>}>Ver cases</Btn>
        </div>

        {/* Stat strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
          padding: '32px 0',
          borderTop: `1px solid ${T.borderDark}`,
          borderBottom: `1px solid ${T.borderDark}`,
        }}>
          {[
            { v: '14', l: 'estados no Brasil' },
            { v: '6 anos', l: 'no setor de seguros' },
            { v: '+312%', l: 'volume de leads médio' },
            { v: 'SUSEP', l: 'fundador certificado' },
          ].map((s, i) => (
            <div key={i} style={{ borderLeft: i ? `1px solid ${T.borderDark}` : 'none', padding: '4px 16px' }}>
              <div className="cd-tnum" style={{
                fontFamily: T.fontDisplay, fontWeight: 600,
                fontSize: 'clamp(36px, 4vw, 56px)',
                color: T.brandTint, lineHeight: 1, letterSpacing: '-0.04em',
              }}>{s.v}</div>
              <div style={{ fontSize: 12, color: T.brandLight, marginTop: 8, letterSpacing: '0.04em' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   HERO 3 — EDITORIAL · FOTO DO BRUNO
   ============================================================ */
function Hero3_Founder() {
  return (
    <section style={{
      position: 'relative', background: T.offWhite,
      padding: '80px 0 80px', overflow: 'hidden', fontFamily: T.fontBody,
    }}>
      <Container max={1280}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
          {/* Photo + accent card */}
          <div style={{ position: 'relative' }}>
            <div style={{
              aspectRatio: '4/5',
              background: `linear-gradient(180deg, rgba(124,58,237,0.15), rgba(26,10,46,0.85)), url(assets/bruno.jpg) center/cover`,
              borderRadius: 24,
              filter: 'saturate(0.85) contrast(1.05)',
              position: 'relative', overflow: 'hidden',
              border: `1px solid ${T.neutralMid}`,
            }}>
              {/* Identity badge */}
              <div style={{
                position: 'absolute', bottom: 20, left: 20, right: 20,
                background: 'rgba(26,10,46,0.75)',
                backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                border: `1px solid ${T.borderDark}`,
                borderRadius: 14, padding: 16,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'rgba(124,58,237,0.30)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: T.brandLight, flexShrink: 0,
                }}>
                  <Icons.ShieldCheck size={22}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: T.brandTint, fontSize: 13, fontWeight: 600 }}>Bruno de Castro</div>
                  <div style={{ color: T.brandLight, fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.02em' }}>
                    SUSEP 10.2024.847291 · ativo
                  </div>
                </div>
              </div>
            </div>

            {/* Accent stat card */}
            <div style={{
              position: 'absolute', top: 32, right: -24,
              background: T.brandDark, color: T.brandTint,
              borderRadius: 16, padding: '20px 24px',
              border: `1px solid ${T.borderDark}`,
              boxShadow: '0 24px 48px -16px rgba(124,58,237,0.45)',
              minWidth: 180,
            }}>
              <div style={{ fontSize: 11, color: T.brandLight, letterSpacing: '0.10em', textTransform: 'uppercase' }}>Vendendo plano há</div>
              <div className="cd-tnum" style={{
                fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 48,
                lineHeight: 1, letterSpacing: '-0.03em', marginTop: 6,
              }}>6 anos</div>
            </div>
          </div>

          {/* Copy */}
          <div>
            <Eyebrow>O fundador</Eyebrow>
            <h1 style={{
              fontFamily: T.fontDisplay, fontWeight: 600,
              fontSize: 'clamp(40px, 4.5vw, 68px)',
              lineHeight: 1.02, letterSpacing: '-0.025em',
              color: T.deepViolet, margin: '20px 0 24px',
              textWrap: 'balance',
            }}>
              Criado por dentro.<br/>
              Pensado pro <span style={{ color: T.brandPurple }}>seu resultado.</span>
            </h1>
            <p style={{
              fontSize: 20, lineHeight: 1.5, color: T.fgMuted,
              maxWidth: 480, margin: '0 0 24px',
              textWrap: 'pretty',
            }}>
              Bruno tem SUSEP ativa e 6 anos vendendo plano de saúde.
              A Cranium não <em style={{ fontStyle: 'normal', color: T.brandPurple }}>aprende</em> o mercado — ela <em style={{ fontStyle: 'normal', color: T.brandPurple }}>mora</em> nele.
            </p>

            <blockquote style={{
              fontFamily: T.fontDisplay, fontStyle: 'italic',
              fontSize: 17, lineHeight: 1.6, color: T.deepViolet,
              borderLeft: `3px solid ${T.brandPurple}`,
              padding: '0 0 0 20px', margin: '0 0 32px',
              maxWidth: 480,
            }}>
              "Lead que chega 23h47 é atendido 23h47.<br/>
              <span style={{ color: T.fgMuted }}>Sem IA isso é matematicamente impossível."</span>
            </blockquote>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Btn variant="primary" size="lg" iconRight={<Icons.ArrowRight size={18}/>}>Conversar com a IA</Btn>
              <Btn variant="secondary" size="lg" icon={<Icons.User size={16}/>}>Conhecer o Bruno</Btn>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   HERO 4 — TERMINAL/CODE · vibe técnica AI/dev
   ============================================================ */
function Hero4_Terminal() {
  return (
    <section style={{
      position: 'relative', background: T.deepViolet,
      padding: '100px 0', overflow: 'hidden', fontFamily: T.fontBody,
    }}>
      <NeuralBG opacity={0.2}/>
      <Container max={1280} style={{ position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
          {/* Copy */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontFamily: T.fontMono, fontSize: 12,
              padding: '6px 12px', borderRadius: 6,
              background: 'rgba(167,139,250,0.08)', border: `1px solid ${T.borderDark}`,
              color: T.brandLight, marginBottom: 28,
              letterSpacing: '0.04em',
            }}>
              <span style={{ color: T.success }}>●</span> cranium-ia/runtime · v2.4.1
            </div>

            <h1 style={{
              fontFamily: T.fontDisplay, fontWeight: 600,
              fontSize: 'clamp(40px, 5vw, 72px)',
              lineHeight: 1.02, letterSpacing: '-0.025em',
              color: T.brandTint, margin: '0 0 24px',
              textWrap: 'balance',
            }}>
              Operação online inteira<br/>
              <span style={{ color: T.brandLight }}>em um lugar só.</span>
            </h1>

            <p style={{
              fontSize: 19, lineHeight: 1.55, color: T.neutralSoft,
              maxWidth: 480, margin: '0 0 32px',
            }}>
              Tráfego, conteúdo, comercial, CRM, automação.
              A estrutura online da sua corretora — feita por quem entende seguros.
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 36 }}>
              <Btn variant="primary" size="lg" iconRight={<Icons.ArrowRight size={18}/>}>Agendar diagnóstico</Btn>
              <Btn variant="secondaryDark" size="lg" icon={<Icons.Cpu size={16}/>}>Ver capacidades</Btn>
            </div>

            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              {['Unimed', 'Amil', 'SulAmérica', 'Bradesco', 'Hapvida'].map(op => (
                <div key={op} style={{
                  fontFamily: T.fontMono, fontSize: 13,
                  color: T.brandLight, opacity: 0.7,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ width: 4, height: 4, borderRadius: 999, background: T.success }}/>
                  {op}
                </div>
              ))}
            </div>
          </div>

          {/* Terminal */}
          <div style={{
            background: '#0F0220',
            border: `1px solid ${T.borderDark}`,
            borderRadius: 16,
            fontFamily: T.fontMono,
            fontSize: 13,
            boxShadow: '0 32px 64px -16px rgba(124,58,237,0.5)',
            overflow: 'hidden',
          }}>
            {/* Title bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px',
              borderBottom: `1px solid ${T.borderDark}`,
              background: 'rgba(167,139,250,0.04)',
            }}>
              {['#FF5F57','#FEBC2E','#28C840'].map(c => <span key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c, opacity: 0.5 }}/>)}
              <span style={{ flex: 1, textAlign: 'center', color: T.brandLight, fontSize: 11, letterSpacing: '0.04em' }}>cranium · live conversation</span>
              <span style={{ color: T.success, fontSize: 10 }}>● live</span>
            </div>

            {/* Code body */}
            <div style={{ padding: 24, lineHeight: 1.75, color: T.neutralSoft }}>
              <div><span style={{ color: '#64748B' }}># lead recebido — 23:47</span></div>
              <div style={{ marginTop: 6 }}>
                <span style={{ color: T.brandLight }}>lead</span>
                <span style={{ color: '#64748B' }}>.intent </span>
                <span style={{ color: T.success }}>→ "cotação PME"</span>
              </div>
              <div>
                <span style={{ color: T.brandLight }}>lead</span>
                <span style={{ color: '#64748B' }}>.size </span>
                <span style={{ color: T.success }}>→ <span className="cd-tnum">12 vidas</span></span>
              </div>
              <div>
                <span style={{ color: T.brandLight }}>lead</span>
                <span style={{ color: '#64748B' }}>.location </span>
                <span style={{ color: T.success }}>→ São Paulo · SP</span>
              </div>
              <div style={{ marginTop: 14 }}>
                <span style={{ color: '#64748B' }}># cranium qualifica…</span>
              </div>
              <div style={{ marginTop: 6, padding: '10px 14px', background: 'rgba(124,58,237,0.10)', borderLeft: `2px solid ${T.brandLight}`, borderRadius: 4, color: T.brandTint }}>
                "Faixa etária média da equipe e<br/>
                rede credenciada — nacional ou regional?"
              </div>
              <div style={{ marginTop: 18 }}>
                <span style={{ color: T.success }}>✓</span>
                <span style={{ color: T.brandTint }}> lead.qualified </span>
                <span style={{ color: '#64748B' }}>→ </span>
                <span style={{ color: T.brandLight }}>encaminhar(<span className="cd-tnum">corretor.id=4218</span>)</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, color: T.brandLight }}>
                <span className="cd-pulse" style={{ width: 8, height: 14, background: T.brandLight, borderRadius: 1 }}/>
                <span style={{ color: '#64748B' }}>standby · próximo lead</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   HERO 5 — PROVOCAÇÃO EDITORIAL · pergunta gigante
   ============================================================ */
function Hero5_Provocation() {
  return (
    <section style={{
      position: 'relative', background: T.deepViolet,
      padding: '88px 0', overflow: 'hidden', fontFamily: T.fontBody, minHeight: 800,
    }}>
      <NeuralBG opacity={0.16} lines={false}/>

      <Container max={1280} style={{ position: 'relative' }}>
        <div style={{
          fontSize: 14, color: T.brandLight, fontFamily: T.fontMono,
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 32,
        }}>
          Pergunta honesta ↓
        </div>

        <h1 style={{
          fontFamily: T.fontDisplay, fontWeight: 600,
          fontSize: 'clamp(56px, 8vw, 132px)',
          lineHeight: 0.95, letterSpacing: '-0.04em',
          color: T.brandTint, margin: '0 0 24px',
          maxWidth: 1100,
          textWrap: 'balance',
        }}>
          Quanto a sua corretora<br/>
          cresceu <span style={{ color: T.brandLight, fontStyle: 'italic', fontWeight: 500 }}>esse</span> ano?
        </h1>

        {/* Annotation */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 999,
          background: 'rgba(124,58,237,0.18)',
          border: '1px dashed rgba(167,139,250,0.45)',
          color: T.brandLight, fontSize: 13,
          marginBottom: 64,
        }}>
          <Icons.AlertTriangle size={14}/>
          Corretora sem tráfego pago + autoridade fica refém de indicação. E indicação não escala.
        </div>

        {/* Comparativo */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 0,
          alignItems: 'stretch', marginBottom: 56,
          maxWidth: 1100,
        }}>
          {/* Sem Cranium */}
          <div style={{
            background: 'rgba(167,139,250,0.04)',
            border: `1px solid ${T.borderDark}`,
            borderRadius: 20, padding: 28,
          }}>
            <div style={{ fontSize: 12, color: T.fgMuted, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 16 }}>
              Sem estrutura
            </div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 56, fontWeight: 600, color: T.brandTint, lineHeight: 1, letterSpacing: '-0.03em' }} className="cd-tnum">
              0 <span style={{ color: T.fgMuted, fontSize: 24, fontWeight: 400, letterSpacing: 0 }}>leads frios</span>
            </div>
            <div style={{ fontSize: 14, color: T.neutralSoft, marginTop: 12, lineHeight: 1.5 }}>
              Indicação só. Site parado. Anúncio do "primo que faz". Você refém do mês passado.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.brandLight }}>
            <Icons.ArrowRight size={32}/>
          </div>

          {/* Com Cranium */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(124,58,237,0.18), rgba(124,58,237,0.06))',
            border: '1px solid rgba(124,58,237,0.45)',
            borderRadius: 20, padding: 28,
            boxShadow: '0 0 0 1px rgba(167,139,250,0.2), 0 32px 64px -16px rgba(124,58,237,0.4)',
          }}>
            <div style={{ fontSize: 12, color: T.brandLight, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 600 }}>
              Com Cranium
            </div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 56, fontWeight: 600, color: T.brandTint, lineHeight: 1, letterSpacing: '-0.03em' }} className="cd-tnum">
              +312% <span style={{ color: T.brandLight, fontSize: 24, fontWeight: 400, letterSpacing: 0 }}>volume</span>
            </div>
            <div style={{ fontSize: 14, color: T.neutralSoft, marginTop: 12, lineHeight: 1.5 }}>
              Tráfego rodando, autoridade construída, comercial estruturado. Você cresce por sistema.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn variant="primary" size="lg" iconRight={<Icons.ArrowRight size={18}/>}>Agendar diagnóstico</Btn>
          <Btn variant="text" size="lg">
            ou veja como funciona <Icons.ArrowRight size={14} style={{ marginLeft: 4 }}/>
          </Btn>
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   Heros wrapper — empilhados pra preview
   ============================================================ */
function Heros() {
  const heros = [
    { n: 1, name: 'Split + Chat preview', sub: 'RECOMENDADO · produto vendendo a si mesmo', comp: Hero1_Split },
    { n: 2, name: 'Centrado + numerais gigantes', sub: 'Stat-driven, autoridade direta', comp: Hero2_Centered },
    { n: 3, name: 'Editorial · foto do Bruno', sub: 'Autoridade humana, SUSEP visível', comp: Hero3_Founder },
    { n: 4, name: 'Terminal · vibe técnica', sub: 'Geist/Vercel-flavored, prova de domínio', comp: Hero4_Terminal },
    { n: 5, name: 'Provocação editorial', sub: 'Tipografia gigante, pergunta + comparativo', comp: Hero5_Provocation },
  ];
  return (
    <div style={{ background: '#f0eee9', display: 'flex', flexDirection: 'column' }}>
      {heros.map(h => (
        <div key={h.n}>
          <div style={{
            padding: '24px 40px 16px', background: '#f0eee9', fontFamily: T.fontBody,
            display: 'flex', alignItems: 'baseline', gap: 16, borderBottom: '1px dashed rgba(124,58,237,0.18)',
          }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 13, color: T.brandPurple, fontWeight: 600 }}>HERO {String(h.n).padStart(2, '0')}</span>
            <span style={{ fontWeight: 600, color: T.deepViolet, fontSize: 16 }}>{h.name}</span>
            <span style={{ color: T.fgMuted, fontSize: 13 }}>{h.sub}</span>
          </div>
          <h.comp />
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Hero1_Split, Hero2_Centered, Hero3_Founder, Hero4_Terminal, Hero5_Provocation, Heros, HeroDashboard, FounderPill });
