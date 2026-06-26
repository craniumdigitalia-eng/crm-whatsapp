// 10 Section types — patterns reutilizáveis em páginas
// 1. Grid · 2. Lista · 3. Comparativo · 4. Timeline · 5. Tabs
// 6. Accordion · 7. Carrossel · 8. Logos · 9. Estatísticas · 10. Pricing

/* ============================================================
   Section header helper
   ============================================================ */
function SectionHead({ eyebrow, title, lead, dark, align = 'left', maxWidth = 720 }) {
  return (
    <div style={{ maxWidth, marginLeft: align === 'center' ? 'auto' : 0, marginRight: align === 'center' ? 'auto' : 0, marginBottom: 56, textAlign: align }}>
      {eyebrow && <div style={{ marginBottom: 16 }}><Eyebrow dark={dark}>{eyebrow}</Eyebrow></div>}
      <h2 style={{
        fontFamily: T.fontDisplay, fontWeight: 600,
        fontSize: 'clamp(28px, 3.2vw, 44px)',
        lineHeight: 1.08, letterSpacing: '-0.02em',
        color: dark ? T.brandTint : T.deepViolet, margin: 0,
        textWrap: 'balance',
      }}>{title}</h2>
      {lead && (
        <p style={{
          marginTop: 16, fontFamily: T.fontBody,
          fontSize: 'clamp(17px, 1.3vw, 20px)', lineHeight: 1.5,
          color: dark ? T.neutralSoft : T.fgMuted, margin: '16px 0 0',
          textWrap: 'pretty',
        }}>{lead}</p>
      )}
    </div>
  );
}

/* ============================================================
   1. GRID (features)
   ============================================================ */
function Sec_Grid() {
  const items = [
    { ico: <Icons.Target/>,       t: 'Tráfego pago',           d: 'Meta Ads + Google Ads rodando estratégia diária. Lead qualificado pra corretora de seguros — com criativo, copy e segmentação do setor.' },
    { ico: <Icons.Award/>,        t: 'Posicionamento de autoridade', d: 'Conteúdo pro Instagram, LinkedIn e blog que faz cliente e operadora reconhecerem você como referência regional ou nacional.' },
    { ico: <Icons.TrendingUp/>,  t: 'Estruturação comercial',    d: 'Processo de vendas, scripts, CRM, follow-up sistemático. Da prospecção ao fechamento — com métrica em cada etapa.' },
    { ico: <Icons.Globe/>,        t: 'Estrutura online completa',   d: 'Site, redes, automação, WhatsApp Business. Toda a operação online da sua corretora num lugar só.' },
    { ico: <Icons.ShieldCheck/>, t: 'SUSEP + 6 anos no setor',     d: 'Fundador com SUSEP ativa, 6 anos vendendo seguros. A gente não aprende o mercado — mora nele.' },
    { ico: <Icons.Bot/>,          t: 'IA quando faz sentido',       d: 'Atendimento por IA p/ corretoras com volume alto que precisa escalar. Capability disponível; não é o que nos define.' },
  ];
  return (
    <section style={{ background: T.offWhite, padding: '100px 0', fontFamily: T.fontBody }}>
      <Container max={1280}>
        <SectionHead
          eyebrow="O que entregamos"
          title={<>Quatro pilares.<br/>Uma <em style={{ fontStyle: 'normal', color: T.brandPurple }}>operação</em> inteira.</>}
          lead="Foco 100% em corretora de seguros. A gente não vende módulo solto — monta a estrutura online inteira, do tráfego ao fechamento."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {items.map((f, i) => (
            <div key={i} style={{
              background: '#fff',
              border: `1px solid ${T.neutralMid}`,
              borderRadius: 20, padding: 28,
              boxShadow: T.shadowMd,
              transition: 'border-color 220ms, transform 220ms, box-shadow 220ms',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 32px -12px rgba(124,58,237,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.neutralMid; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -8px rgba(124,58,237,0.10)'; }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: T.brandTint, color: T.brandPurple,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}>{f.ico}</div>
              <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 18, lineHeight: 1.25, letterSpacing: '-0.01em', color: T.deepViolet, margin: '0 0 8px' }}>{f.t}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: T.fgMuted, margin: 0 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   2. LISTA (passos numerados)
   ============================================================ */
function Sec_List() {
  const steps = [
    { n: '01', t: 'Diagnóstico da corretora', d: 'Conversa de 30min: tamanho da operação, canais que você já usa, onde tráfego trava, gargalo comercial. Sem follow-up agressivo.' },
    { n: '02', t: 'Plano dos 4 pilares',      d: 'Roteiro escrito: o que rodar em tráfego, conteúdo pra autoridade, processo comercial e a estrutura online. Você vê antes de fechar.' },
    { n: '03', t: 'Implementação em 30 dias', d: 'A gente liga campanhas, monta conteúdo de autoridade, estrutura CRM e instala automações. 1 ponto focal cuidando da sua operação.' },
    { n: '04', t: 'Operação contínua + reports', d: 'Reunião quinzenal de performance, dashboard ao vivo, ajustes por dado. Você vê ROI — ou a gente sai sem multa.' },
  ];
  return (
    <section style={{ background: T.surfaceLight, padding: '100px 0', fontFamily: T.fontBody }}>
      <Container max={1280}>
        <SectionHead
          eyebrow="Como funciona"
          title="Quatro passos. Sem caixa-preta."
          lead="Não é 'pacote de serviço' genérico. Em 30 dias depois do diagnóstico, você já vê o primeiro lead do funil novo."
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 32,
              padding: '32px 0', alignItems: 'start',
              borderTop: i === 0 ? `1px solid ${T.neutralMid}` : 'none',
              borderBottom: `1px solid ${T.neutralMid}`,
            }}>
              <div className="cd-tnum" style={{
                fontFamily: T.fontMono, fontSize: 13,
                color: T.brandPurple, letterSpacing: '0.02em',
              }}>{s.n}</div>
              <div>
                <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 28, letterSpacing: '-0.02em', color: T.deepViolet, margin: '0 0 8px', lineHeight: 1.1 }}>{s.t}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.55, color: T.fgMuted, margin: 0, maxWidth: 640 }}>{s.d}</p>
              </div>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: T.brandTint, color: T.brandPurple,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 4,
              }}>
                <Icons.ArrowRight size={20}/>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   3. COMPARATIVO (com vs sem)
   ============================================================ */
function Sec_Comparative() {
  const rows = [
    { sem: 'Refém de indicação. Volume oscila todo mês.',                    com: 'Tráfego rodando: lead novo previsível — com custo medido.' },
    { sem: 'Anúncio do "primo que faz" — sem dado, sem teste.',              com: 'Mídia gerenciada por especialista. Criativo testado semanalmente.' },
    { sem: 'Instagram parado, LinkedIn idem. Cliente nem sabe que existe.',  com: 'Conteúdo de autoridade no ar. Você aparece quando ele procura.' },
    { sem: 'Lead esquecido. Follow-up só quando lembra.',                     com: 'CRM estruturado. Cadência de contato sistemática.' },
    { sem: 'Sem dashboard. Achismo sobre o que está dando certo.',            com: 'Painel ao vivo: míia, comercial, taxa por etapa.' },
  ];
  return (
    <section style={{ background: T.deepViolet, padding: '100px 0', fontFamily: T.fontBody, position: 'relative', overflow: 'hidden' }}>
      <NeuralBG opacity={0.16}/>
      <Container max={1280} style={{ position: 'relative' }}>
        <SectionHead
          dark
          eyebrow="Sem rodeio · comparativo direto"
          title={<>Operação <span style={{ color: T.brandLight }}>estruturada</span> vs operação refém.</>}
          lead="Não é sobre ter ferramenta nova. É sobre ter sistema rodando — e você não ser o gargalo."
        />
        <div style={{
          background: 'rgba(167,139,250,0.04)',
          border: `1px solid ${T.borderDark}`,
          borderRadius: 24, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            background: 'rgba(15,2,32,0.5)',
            borderBottom: `1px solid ${T.borderDark}`,
          }}>
            <div style={{ padding: '20px 28px', borderRight: `1px solid ${T.borderDark}` }}>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.fgMuted, marginBottom: 4 }}>Sem Cranium</div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.neutralSoft, letterSpacing: '-0.01em' }}>Operação manual</div>
            </div>
            <div style={{ padding: '20px 28px', background: 'rgba(124,58,237,0.12)' }}>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.brandLight, marginBottom: 4 }}>Com Cranium</div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.brandTint, letterSpacing: '-0.01em' }}>Operação com IA</div>
            </div>
          </div>

          {rows.map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              borderBottom: i < rows.length - 1 ? `1px solid ${T.borderDark}` : 'none',
            }}>
              <div style={{
                padding: '24px 28px', borderRight: `1px solid ${T.borderDark}`,
                display: 'flex', alignItems: 'flex-start', gap: 12,
                color: T.neutralSoft, fontSize: 15, lineHeight: 1.5,
              }}>
                <Icons.XCircle size={18} style={{ color: T.fgMuted, marginTop: 1, flexShrink: 0 }}/>
                {r.sem}
              </div>
              <div style={{
                padding: '24px 28px',
                background: 'rgba(124,58,237,0.04)',
                display: 'flex', alignItems: 'flex-start', gap: 12,
                color: T.brandTint, fontSize: 15, lineHeight: 1.5,
              }}>
                <Icons.CheckCircle size={18} style={{ color: T.success, marginTop: 1, flexShrink: 0 }}/>
                {r.com}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   4. TIMELINE (history)
   ============================================================ */
function Sec_Timeline() {
  const events = [
    { y: '2019', t: 'Bruno tira SUSEP', d: 'Primeira venda como corretor de seguros. Ali começa a observar o gap entre quem vende bem e quem não vende.' },
    { y: '2021', t: 'Operação própria em escala', d: 'Estruturação de tráfego, conteúdo e comercial pra própria carteira. Cresce 4x em 18 meses.' },
    { y: '2023', t: 'Cranium nasce', d: 'A metodologia que funcionou pra ele vira agência. Primeiras corretoras parceiras embarcam.' },
    { y: '2025', t: '+180 corretoras em 14 estados', d: 'Operação consolidada com os 4 pilares rodando em escala nacional.' },
    { y: '2026', t: 'Você aqui →', d: 'Pronto pra ter equipe inteira cuidando da sua estrutura online — enquanto você vende.' },
  ];
  return (
    <section style={{ background: T.offWhite, padding: '100px 0', fontFamily: T.fontBody }}>
      <Container max={1280}>
        <SectionHead eyebrow="Linha do tempo" title="De carteira própria a metodologia." lead="Como Bruno transformou o que funcionou na própria operação em agência."/>
        <div style={{ position: 'relative', paddingLeft: 32 }}>
          {/* timeline rail */}
          <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: `linear-gradient(180deg, ${T.brandPurple}, rgba(124,58,237,0.1))` }}/>
          {events.map((e, i) => (
            <div key={i} style={{ position: 'relative', paddingBottom: i === events.length - 1 ? 0 : 40 }}>
              <div style={{
                position: 'absolute', left: -32, top: 4,
                width: 16, height: 16, borderRadius: 999,
                background: i === events.length - 1 ? T.brandPurple : '#fff',
                border: `2px solid ${T.brandPurple}`,
                boxShadow: i === events.length - 1 ? '0 0 0 6px rgba(124,58,237,0.15)' : 'none',
              }}/>
              <div className="cd-tnum" style={{
                fontFamily: T.fontMono, fontSize: 13,
                color: T.brandPurple, fontWeight: 500, letterSpacing: '0.02em',
                marginBottom: 6,
              }}>{e.y}</div>
              <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 24, letterSpacing: '-0.015em', color: T.deepViolet, margin: '0 0 8px', lineHeight: 1.2 }}>{e.t}</h3>
              <p style={{ fontSize: 16, lineHeight: 1.55, color: T.fgMuted, margin: 0, maxWidth: 580 }}>{e.d}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   5. TABS (interativo)
   ============================================================ */
function Sec_Tabs() {
  const tabs = [
    {
      id: 'trafego', label: 'Tráfego', icon: <Icons.Target size={16}/>,
      title: 'Tráfego pago que vira lead qualificado.',
      body: 'Estratégia diária de Meta Ads + Google Ads pra corretora de seguros. Criativo, copy e segmentação feitos por quem entende o setor — não por estagiário com playbook genérico.',
      stat: { v: '+312%', l: 'volume médio em 90 dias' },
    },
    {
      id: 'autoridade', label: 'Autoridade', icon: <Icons.Award size={16}/>,
      title: 'Posicionamento que vende sozinho.',
      body: 'Conteúdo consistente em Instagram, LinkedIn e blog pra sua corretora virar referência regional ou nacional. Cliente passa a buscar você — não o contrário.',
      stat: { v: '4x', l: 'engajamento médio em 6 meses' },
    },
    {
      id: 'comercial', label: 'Comercial', icon: <Icons.TrendingUp size={16}/>,
      title: 'Processo de vendas estruturado.',
      body: 'Script, CRM, follow-up sistemático, dashboard de pipeline. Da prospecção ao fechamento — com métrica em cada etapa pra você saber onde otimizar.',
      stat: { v: '38%↓', l: 'no-show em reuniões' },
    },
    {
      id: 'estrutura', label: 'Estrutura online', icon: <Icons.Globe size={16}/>,
      title: 'A operação online inteira.',
      body: 'Site novo, redes ativas, WhatsApp Business configurado, automações ligadas. Tudo no mesmo padrão de marca — e tudo cuidado pela mesma equipe.',
      stat: { v: '30 dias', l: 'pra estrutura no ar' },
    },
  ];
  const [active, setActive] = React.useState('trafego');
  const cur = tabs.find(t => t.id === active);

  return (
    <section style={{ background: T.surfaceLight, padding: '100px 0', fontFamily: T.fontBody }}>
      <Container max={1280}>
        <SectionHead align="center" eyebrow="Os 4 pilares da Cranium" title="Tráfego, autoridade, comercial, estrutura." lead="Cada pilar tem metodologia própria — mas rodam integrados. Você não contrata 4 agências."/>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 40, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActive(t.id)} style={{
              padding: '12px 20px', borderRadius: 999, border: 'none',
              background: active === t.id ? T.brandPurple : 'transparent',
              color: active === t.id ? '#fff' : T.deepViolet,
              fontFamily: T.fontBody, fontWeight: 500, fontSize: 14,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'background 180ms',
              boxShadow: active === t.id ? '0 8px 24px -8px rgba(124,58,237,0.45)' : 'none',
            }}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div style={{
          background: '#fff', border: `1px solid ${T.neutralMid}`,
          borderRadius: 24, padding: 48,
          display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 56, alignItems: 'center',
          boxShadow: '0 24px 64px -24px rgba(124,58,237,0.18)',
          minHeight: 320,
        }}>
          <div>
            <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 36, letterSpacing: '-0.02em', color: T.deepViolet, margin: '0 0 16px', lineHeight: 1.1, textWrap: 'balance' }}>{cur.title}</h3>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: T.fgMuted, margin: '0 0 24px', textWrap: 'pretty' }}>{cur.body}</p>
            <Btn variant="primary" size="md" iconRight={<Icons.ArrowRight size={16}/>}>Ver demonstração</Btn>
          </div>
          <div style={{
            background: T.deepViolet,
            border: `1px solid ${T.borderDark}`,
            borderRadius: 16, padding: 32, textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <NeuralBG opacity={0.16} lines={false}/>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, color: T.brandLight, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 12 }}>Resultado típico</div>
              <div className="cd-tnum" style={{
                fontFamily: T.fontDisplay, fontWeight: 600,
                fontSize: 96, lineHeight: 1, letterSpacing: '-0.04em',
                color: T.brandTint, margin: '0 0 12px',
              }}>{cur.stat.v}</div>
              <div style={{ fontSize: 14, color: T.brandLight, lineHeight: 1.5 }}>{cur.stat.l}</div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   6. ACCORDION (FAQ)
   ============================================================ */
function Sec_Accordion() {
  const items = [
    { q: 'Vocês são agência genérica ou especializada em corretoras?',
      a: '100% especializada em corretoras de seguros. SUSEP no fundador. Não atendemos outros setores — essa especialização é o que dá vantagem em criativo, copy, escolha de pauta e processo comercial.' },
    { q: 'Qual a diferença entre vocês e uma agência tradicional?',
      a: 'Agência tradicional faz peça, entrega e tchau. A gente monta a operação online inteira (tráfego + autoridade + comercial + estrutura) e fica rodando junto. É modelo de serviço contínuo — não de projeto pontual.' },
    { q: 'Quanto custa? Tem mensalidade?',
      a: 'Setup + mensalidade contínua, calibrados pelo tamanho da operação. Em vez de tabela pública, agendamos 30min de diagnóstico e enviamos proposta sob medida. Sem fidelidade contratual.' },
    { q: 'Quanto tempo até ver resultado?',
      a: '30 dias pra estrutura estar no ar (campanhas rodando, conteúdo publicando, CRM montado). 90 dias pra ter dado robusto de ROI. Antes disso é calibragem — normal.' },
    { q: 'Vocês também fazem IA de atendimento?',
      a: 'Temos capability, mas não é nosso foco primário. Ligamos IA pra corretoras com volume alto que precisa escalar — normalmente em cliente já rodando operação completa. Não vendemos IA solta.' },
  ];
  const [open, setOpen] = React.useState(0);

  return (
    <section style={{ background: T.offWhite, padding: '100px 0', fontFamily: T.fontBody }}>
      <Container max={920}>
        <SectionHead eyebrow="Perguntas honestas" title="Dúvidas reais de quem contrata agência." lead="A gente respeita seu tempo. Aqui estão as perguntas reais — não as inventadas."/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {items.map((it, i) => (
            <div key={i} style={{ borderTop: i === 0 ? `1px solid ${T.neutralMid}` : 'none', borderBottom: `1px solid ${T.neutralMid}` }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} style={{
                width: '100%', background: 'transparent', border: 'none',
                padding: '24px 0', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 24, textAlign: 'left',
              }}>
                <span style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontSize: 20, letterSpacing: '-0.01em', color: T.deepViolet, lineHeight: 1.3 }}>{it.q}</span>
                <span style={{
                  width: 36, height: 36, borderRadius: 999,
                  background: open === i ? T.brandPurple : T.brandTint,
                  color: open === i ? '#fff' : T.brandPurple,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 220ms',
                  transform: open === i ? 'rotate(180deg)' : 'rotate(0)',
                }}>
                  <Icons.ChevronDown size={18}/>
                </span>
              </button>
              <div style={{
                maxHeight: open === i ? 400 : 0,
                overflow: 'hidden',
                transition: 'max-height 360ms cubic-bezier(0.22,1,0.36,1), padding 220ms',
              }}>
                <p style={{ fontSize: 16, lineHeight: 1.7, color: T.fgMuted, margin: 0, paddingBottom: 24, maxWidth: 740 }}>{it.a}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <Btn variant="ghost" iconRight={<Icons.ArrowRight size={16}/>}>Ver todas as perguntas</Btn>
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   7. CARROSSEL (depoimentos)
   ============================================================ */
function Sec_Carousel() {
  const testimonials = [
    { q: 'Em 60 dias tava com tráfego rodando e 3x mais lead. Não entendo como rodei tantos anos sem.',         n: 'Marcos R.',    r: 'Corretora autônoma · SP',     k: '+ R$ 4.200/mês em prêmio', img: '#7C3AED' },
    { q: 'Pararam de tratar a gente como cliente de SDR. Bruno entende seguros — fala como corretor.',           n: 'Carolina T.', r: 'Sócia · Corretora Belo Horizonte', k: '2x leads em 6 meses', img: '#A78BFA' },
    { q: 'Antes era indicação e sorte. Hoje é mítrica de Míia e CRM rodando. Outro patamar de previsibilidade.',  n: 'Roberto F.',  r: 'Corretora · 12 anos de mercado', k: '+18 vidas/mês fechadas', img: '#5B21B6' },
    { q: 'A estrutura online deles é outra coisa. Site, redes, conteúdo, CRM — tudo no mesmo padrão.',           n: 'Ana Paula M.', r: 'Corretora PME · Curitiba',  k: 'Top 1% engajamento no Insta de seguros', img: '#7C3AED' },
  ];
  const [idx, setIdx] = React.useState(0);
  return (
    <section style={{ background: T.deepViolet, padding: '100px 0', fontFamily: T.fontBody, position: 'relative', overflow: 'hidden' }}>
      <NeuralBG opacity={0.15} lines={false}/>
      <Container max={1280} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, gap: 32, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 600 }}>
            <Eyebrow dark>O que dizem os corretores</Eyebrow>
            <h2 style={{ marginTop: 16, fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 'clamp(28px, 3.2vw, 44px)', lineHeight: 1.08, letterSpacing: '-0.02em', color: T.brandTint }}>
              Quem usa, fala.
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setIdx((idx - 1 + testimonials.length) % testimonials.length)} style={{
              width: 44, height: 44, borderRadius: 999,
              background: 'rgba(167,139,250,0.08)', border: `1px solid ${T.borderDark}`,
              color: T.brandLight, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}><Icons.ArrowLeft size={18}/></button>
            <button onClick={() => setIdx((idx + 1) % testimonials.length)} style={{
              width: 44, height: 44, borderRadius: 999,
              background: T.brandPurple, border: 'none',
              color: '#fff', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}><Icons.ArrowRight size={18}/></button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          {[testimonials[idx], testimonials[(idx + 1) % testimonials.length]].map((t, i) => (
            <div key={`${idx}-${i}`} style={{
              background: 'rgba(167,139,250,0.04)',
              border: `1px solid ${T.borderDark}`,
              borderRadius: 20, padding: 32,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 28, minHeight: 320,
              transition: 'transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 320ms',
            }}>
              <div>
                <Icons.Quote size={28} style={{ color: T.brandLight, opacity: 0.5, marginBottom: 16 }}/>
                <p style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontSize: 22, lineHeight: 1.35, letterSpacing: '-0.01em', color: T.brandTint, margin: 0, textWrap: 'balance' }}>
                  "{t.q}"
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 999,
                  background: t.img,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 16,
                }}>{t.n[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: T.brandTint, fontSize: 14, fontWeight: 500 }}>{t.n}</div>
                  <div style={{ color: T.brandLight, fontSize: 12 }}>{t.r}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: T.success, fontSize: 11, fontFamily: T.fontMono, letterSpacing: '0.02em', fontWeight: 500 }}>{t.k}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   8. LOGOS (operadoras)
   ============================================================ */
function Sec_Logos() {
  const operadoras = [
    { name: 'Unimed',         accent: '#00995D' },
    { name: 'Amil',           accent: '#0066B3' },
    { name: 'SulAmérica',     accent: '#FF6900' },
    { name: 'Bradesco Saúde', accent: '#CC092F' },
    { name: 'Hapvida',        accent: '#7C3AED' },
    { name: 'Porto Saúde',    accent: '#003C71' },
    { name: 'Prevent Senior', accent: '#0066B3' },
    { name: 'Notre Dame',     accent: '#003366' },
  ];
  return (
    <section style={{ background: T.offWhite, padding: '64px 0', borderTop: `1px solid ${T.neutralMid}`, borderBottom: `1px solid ${T.neutralMid}`, fontFamily: T.fontBody }}>
      <Container max={1280}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Eyebrow>Corretoras que atendemos vendem para</Eyebrow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, justifyItems: 'center', alignItems: 'center' }}>
          {operadoras.map(op => (
            <div key={op.name} style={{
              fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 24,
              letterSpacing: '-0.015em', color: T.deepViolet, opacity: 0.5,
              display: 'flex', alignItems: 'center', gap: 10,
              transition: 'opacity 220ms',
              cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: op.accent }}/>
              {op.name}
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: T.fgMuted, fontFamily: T.fontMono, letterSpacing: '0.04em' }}>
          + outras operadoras regionais conforme demanda
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   9. STATS
   ============================================================ */
function Sec_Stats() {
  const stats = [
    { v: '+312%', l: 'volume de leads',  sub: 'média em corretoras com 6 meses de Cranium' },
    { v: '30 dias', l: 'pra estrutura no ar', sub: 'tráfego, conteúdo e CRM ligados' },
    { v: '+180',   l: 'corretoras atendidas', sub: 'em 14 estados desde 2023' },
    { v: 'R$ 8M', l: 'em prêmio gerado', sub: 'somando portfolios de clientes 2025' },
  ];
  return (
    <section style={{ background: T.deepViolet, padding: '100px 0', fontFamily: T.fontBody, position: 'relative', overflow: 'hidden' }}>
      <NeuralBG opacity={0.18}/>
      <Container max={1280} style={{ position: 'relative' }}>
        <SectionHead dark eyebrow="O que rodamos em 2025" title="Dado, não promessa." lead="Cada número aqui sai do dashboard agregado das corretoras que rodaram Cranium por pelo menos 1 trimestre completo."/>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: `1px solid ${T.borderDark}`, borderBottom: `1px solid ${T.borderDark}` }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              padding: '48px 32px',
              borderLeft: i > 0 ? `1px solid ${T.borderDark}` : 'none',
            }}>
              <div className="cd-tnum" style={{
                fontFamily: T.fontDisplay, fontWeight: 600,
                fontSize: 'clamp(48px, 5.5vw, 80px)',
                color: T.brandTint, letterSpacing: '-0.04em', lineHeight: 1,
              }}>{s.v}</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: T.brandLight, marginTop: 16 }}>{s.l}</div>
              <div style={{ fontSize: 13, color: T.neutralSoft, marginTop: 4, lineHeight: 1.5 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   10. PRICING (3 tiers, mas estilo "fale com a gente")
   ============================================================ */
function Sec_Pricing() {
  const tiers = [
    {
      name: 'Diagnóstico',
      tag: 'Ponto de partida',
      desc: 'Auditoria da sua operação online atual. Onde tráfego trava, gargalo comercial, oportunidade de autoridade. Roteiro escrito de 90 dias.',
      includes: ['Diagnóstico de 60min com Bruno', 'Auditoria técnica de tráfego + site', 'Mapa do funil atual', 'Roteiro de 90 dias por escrito'],
      highlight: false,
    },
    {
      name: 'Operação completa',
      tag: 'Os 4 pilares rodando',
      desc: 'Implementação dos 4 pilares e operação contínua. Tráfego, autoridade, comercial, estrutura online — com 1 ponto focal cuidando da sua corretora.',
      includes: ['Tráfego pago gerenciado (Meta + Google)', 'Conteúdo de autoridade (Insta + LinkedIn + blog)', 'CRM + processo comercial estruturado', 'Site novo + automações WhatsApp', 'Reunião quinzenal de performance'],
      highlight: true,
    },
    {
      name: 'Enterprise',
      tag: 'Corretora grande · multi-filial',
      desc: 'Operação multi-filial com SLA, account manager dedicado, integrações sob medida e IA de atendimento ligada quando volume justifica.',
      includes: ['Tudo de Operação completa', 'Account manager dedicado', 'IA de atendimento (quando aplicável)', 'API + integrações sob medida', 'SLA 99.9% + treinamento da equipe'],
      highlight: false,
    },
  ];
  return (
    <section style={{ background: T.offWhite, padding: '100px 0', fontFamily: T.fontBody }}>
      <Container max={1280}>
        <SectionHead align="center" eyebrow="Como contratar" title="Três jeitos de começar com a gente." lead="Em vez de tabela de preço pública genérica, a gente conversa 30min e você sai com proposta personalizada — sem follow-up agressivo."/>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {tiers.map((t, i) => (
            <div key={i} style={{
              position: 'relative',
              background: t.highlight ? T.deepViolet : '#fff',
              color: t.highlight ? T.brandTint : T.deepViolet,
              border: t.highlight ? `1px solid rgba(167,139,250,0.5)` : `1px solid ${T.neutralMid}`,
              borderRadius: 24,
              padding: 36,
              boxShadow: t.highlight ? '0 32px 80px -24px rgba(124,58,237,0.4)' : '0 1px 2px rgba(15,23,42,0.04)',
            }}>
              {t.highlight && (
                <div style={{
                  position: 'absolute', top: -14, left: 32,
                  background: T.brandPurple, color: '#fff',
                  fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase',
                  padding: '6px 14px', borderRadius: 999,
                }}>Mais comum</div>
              )}
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.highlight ? T.brandLight : T.brandPurple, marginBottom: 8 }}>{t.tag}</div>
              <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 36, letterSpacing: '-0.02em', margin: '0 0 12px', lineHeight: 1 }}>{t.name}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: t.highlight ? T.neutralSoft : T.fgMuted, margin: '0 0 24px', minHeight: 60 }}>{t.desc}</p>

              <div style={{
                padding: '16px 0', marginBottom: 24,
                borderTop: `1px solid ${t.highlight ? T.borderDark : T.neutralMid}`,
                borderBottom: `1px solid ${t.highlight ? T.borderDark : T.neutralMid}`,
              }}>
                <div style={{ fontFamily: T.fontDisplay, fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em' }}>Sob consulta</div>
                <div style={{ fontSize: 12, color: t.highlight ? T.brandLight : T.fgMuted, marginTop: 4 }}>Setup + mensalidade · sem fidelidade</div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {t.includes.map(inc => (
                  <li key={inc} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5, color: t.highlight ? T.neutralSoft : T.fgMuted }}>
                    <span style={{ flexShrink: 0, marginTop: 1, color: t.highlight ? T.success : T.brandPurple }}>
                      <Icons.Check size={16}/>
                    </span>
                    {inc}
                  </li>
                ))}
              </ul>

              <Btn variant={t.highlight ? 'primary' : 'secondary'} size="md" fullWidth iconRight={<Icons.ArrowRight size={16}/>}>
                Conversar 15min
              </Btn>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ============================================================
   Sections wrapper
   ============================================================ */
function Sections() {
  const list = [
    { n: 1,  name: 'Grid (features)',       comp: Sec_Grid },
    { n: 2,  name: 'Lista (passos)',        comp: Sec_List },
    { n: 3,  name: 'Comparativo (com/sem)', comp: Sec_Comparative },
    { n: 4,  name: 'Timeline (history)',    comp: Sec_Timeline },
    { n: 5,  name: 'Tabs (interativo)',     comp: Sec_Tabs },
    { n: 6,  name: 'Accordion (FAQ)',       comp: Sec_Accordion },
    { n: 7,  name: 'Carrossel (depoimentos)', comp: Sec_Carousel },
    { n: 8,  name: 'Logos (operadoras)',    comp: Sec_Logos },
    { n: 9,  name: 'Estatísticas',          comp: Sec_Stats },
    { n: 10, name: 'Pricing',               comp: Sec_Pricing },
  ];
  return (
    <div style={{ background: '#f0eee9', display: 'flex', flexDirection: 'column' }}>
      {list.map(s => (
        <div key={s.n}>
          <div style={{
            padding: '24px 40px 16px', background: '#f0eee9', fontFamily: T.fontBody,
            display: 'flex', alignItems: 'baseline', gap: 16, borderBottom: '1px dashed rgba(124,58,237,0.18)',
          }}>
            <span style={{ fontFamily: T.fontMono, fontSize: 13, color: T.brandPurple, fontWeight: 600 }}>SEC {String(s.n).padStart(2, '0')}</span>
            <span style={{ fontWeight: 600, color: T.deepViolet, fontSize: 16 }}>{s.name}</span>
          </div>
          <s.comp/>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, {
  SectionHead, Sec_Grid, Sec_List, Sec_Comparative, Sec_Timeline, Sec_Tabs,
  Sec_Accordion, Sec_Carousel, Sec_Logos, Sec_Stats, Sec_Pricing, Sections,
});
