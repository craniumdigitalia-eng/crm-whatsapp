// Footer — versão completa
// Newsletter + 4 colunas + brand statement + selo SUSEP + legais

function Footer({ mobile = false }) {
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const cols = [
    { title: 'Pilares', items: [
      { label: 'Tráfego pago', href: '#' },
      { label: 'Autoridade', href: '#' },
      { label: 'Comercial', href: '#' },
      { label: 'Estrutura online', href: '#' },
      { label: 'IA de atendimento', href: '#' },
    ]},
    { title: 'Conteúdo', items: [
      { label: 'Blog da corretora', href: '#' },
      { label: 'Cases', href: '#' },
      { label: 'Material complementar', href: '#' },
      { label: 'FAQ', href: '#' },
    ]},
    { title: 'Sobre', items: [
      { label: 'Bruno de Castro', href: '#' },
      { label: 'Manifesto', href: '#' },
      { label: 'Time', href: '#' },
      { label: 'Imprensa', href: '#' },
    ]},
    { title: 'Contato', items: [
      { label: '@craniumdigital.ia', href: '#', icon: <Icons.Instagram size={14}/> },
      { label: 'WhatsApp', href: '#', icon: <Icons.WhatsApp size={14}/> },
      { label: 'contato@cranium.digital', href: '#', icon: <Icons.Mail size={14}/> },
      { label: 'LinkedIn', href: '#', icon: <Icons.Linkedin size={14}/> },
    ]},
  ];

  return (
    <footer style={{
      background: T.deepViolet,
      color: T.brandLight,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: T.fontBody,
    }}>
      <NeuralBG opacity={0.10} lines={false} />

      <Container max={1280} padX={mobile ? 24 : 32} style={{ position: 'relative', paddingTop: mobile ? 64 : 96, paddingBottom: 32 }}>
        {/* TOP: brand statement + newsletter */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1.4fr 1fr',
          gap: mobile ? 40 : 80,
          paddingBottom: mobile ? 48 : 64,
          borderBottom: `1px solid ${T.borderDark}`,
        }}>
          <div>
            <h2 style={{
              fontFamily: T.fontDisplay, fontWeight: 600,
              fontSize: mobile ? 32 : 48, lineHeight: 1.05, letterSpacing: '-0.02em',
              color: T.brandTint, margin: '0 0 24px',
              textWrap: 'balance',
            }}>
              A agência que estrutura<br/>
              <span style={{ color: T.brandLight }}>corretora de seguros.</span>
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: T.neutralSoft, maxWidth: 460, margin: 0 }}>
              Tráfego pago, posicionamento de autoridade, estruturação comercial. Toda a operação online da sua corretora num lugar só — feita por quem entende seguros.
            </p>
          </div>

          {/* Newsletter */}
          <div>
            <div style={{
              fontSize: 11, fontWeight: 500, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: T.brandLight, marginBottom: 12,
            }}>Newsletter do corretor</div>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: T.neutralSoft, margin: '0 0 20px', maxWidth: 360 }}>
              1 e-mail por semana. Sobre IA, vendas de plano e o que está mudando no setor.
              Nada de spam.
            </p>
            {submitted ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 18px', borderRadius: 14,
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.30)',
                color: T.success, fontSize: 14, fontWeight: 500,
              }}>
                <Icons.CheckCircle size={18}/>
                Pronto. Você está dentro.
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} style={{
                display: 'flex', gap: 0,
                background: 'rgba(167,139,250,0.06)',
                border: `1px solid ${T.borderDark}`,
                borderRadius: 999, padding: 4,
              }}>
                <input
                  type="email"
                  required
                  placeholder="seu@email.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    color: T.brandTint, fontSize: 14, fontFamily: T.fontBody,
                    padding: '10px 16px', outline: 'none',
                  }}
                />
                <button type="submit" style={{
                  background: T.brandPurple, color: '#fff', border: 'none',
                  padding: '10px 18px', borderRadius: 999, cursor: 'pointer',
                  fontFamily: T.fontBody, fontWeight: 500, fontSize: 13,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  Entrar <Icons.ArrowRight size={14}/>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* MID: 4 colunas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: mobile ? 32 : 48,
          padding: mobile ? '40px 0' : '64px 0',
        }}>
          {cols.map((c) => (
            <div key={c.title}>
              <div style={{
                fontSize: 11, fontWeight: 500, letterSpacing: '0.10em',
                textTransform: 'uppercase', color: T.brandTint, marginBottom: 16,
              }}>{c.title}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.items.map((it) => (
                  <li key={it.label}>
                    <a href={it.href} style={{
                      color: T.neutralSoft, textDecoration: 'none',
                      fontSize: 14, fontFamily: T.fontBody,
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      transition: 'color 180ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = T.brandLight}
                    onMouseLeave={e => e.currentTarget.style.color = T.neutralSoft}>
                      {it.icon}{it.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* SELO SUSEP */}
        <div style={{
          padding: mobile ? '20px' : '20px 24px',
          background: 'rgba(167,139,250,0.06)',
          border: `1px solid ${T.borderDark}`,
          borderRadius: 16,
          display: 'flex', flexDirection: mobile ? 'column' : 'row',
          alignItems: mobile ? 'flex-start' : 'center', gap: 16,
          marginBottom: 32,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(124,58,237,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.brandLight, flexShrink: 0,
          }}>
            <Icons.ShieldCheck size={22}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: T.brandTint, marginBottom: 2 }}>
              Bruno de Castro · SUSEP ativa
            </div>
            <div style={{ fontSize: 12, color: T.neutralSoft, fontFamily: T.fontMono, letterSpacing: '0.02em' }}>
              Reg. 10.2024.847291 · 6 anos vendendo plano · Nacional
            </div>
          </div>
          <a href="#" style={{
            color: T.brandLight, fontSize: 13, fontWeight: 500,
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            Ver no SUSEP <Icons.ExternalLink size={14}/>
          </a>
        </div>

        {/* BOTTOM */}
        <div style={{
          paddingTop: 24,
          borderTop: `1px solid ${T.borderDark}`,
          display: 'flex', flexDirection: mobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: mobile ? 'flex-start' : 'center',
          gap: mobile ? 16 : 0,
          fontSize: 12, color: T.brandLight, fontFamily: T.fontBody,
        }}>
          <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 6 : 16 }}>
            <span>© 2026 Cranium Digital LTDA</span>
            <span style={{ fontFamily: T.fontMono, opacity: 0.7 }}>CNPJ 48.123.456/0001-77</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Privacidade</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Termos</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>LGPD</a>
          </div>
        </div>
      </Container>
    </footer>
  );
}

window.Footer = Footer;
