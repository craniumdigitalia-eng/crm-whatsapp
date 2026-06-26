// Header — Desktop + Mobile
// Sticky, backdrop-blur sobre dark; nav 4 itens; CTA primário + WhatsApp; mobile com drawer

function Header({ dark = true, current }) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const nav = [
    { label: 'Produto', href: '#servico' },
    { label: 'Para quem é', href: '#paraquem' },
    { label: 'Cases', href: '#cases' },
    { label: 'Sobre', href: '#sobre' },
    { label: 'Blog', href: '#blog' },
  ];

  const bg = dark ? 'rgba(26, 10, 46, 0.78)' : 'rgba(248, 247, 255, 0.85)';
  const fg = dark ? T.neutralSoft : T.deepViolet;
  const fgStrong = dark ? T.brandTint : T.deepViolet;
  const border = dark ? 'rgba(167, 139, 250, 0.12)' : 'rgba(15, 23, 42, 0.08)';

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'blur(14px) saturate(140%)',
      WebkitBackdropFilter: 'blur(14px) saturate(140%)',
      background: bg,
      borderBottom: `1px solid ${border}`,
    }}>
      <Container max={1280} padX={32}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 0', minHeight: 80,
        }}>
          <a href="#" style={{ textDecoration: 'none', display: 'flex' }}>
            <Brand size={32} dark={!dark} />
          </a>

          {/* desktop nav */}
          <nav className="cd-nav-desktop" style={{
            display: 'flex', gap: 36,
            fontFamily: T.fontBody, fontSize: 14, fontWeight: 500,
          }}>
            {nav.map(n => (
              <a key={n.label} href={n.href} style={{
                color: current === n.label ? fgStrong : fg,
                textDecoration: 'none',
                position: 'relative',
                padding: '4px 0',
                transition: 'color 180ms',
              }}
              onMouseEnter={e => e.currentTarget.style.color = fgStrong}
              onMouseLeave={e => e.currentTarget.style.color = current === n.label ? fgStrong : fg}>
                {n.label}
                {current === n.label && (
                  <span style={{
                    position: 'absolute', bottom: -2, left: 0, right: 0,
                    height: 1, background: T.brandLight,
                  }} />
                )}
              </a>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="cd-nav-desktop">
            <a href="#whatsapp" title="WhatsApp" style={{
              width: 40, height: 40, borderRadius: 999,
              background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: T.success, textDecoration: 'none',
              transition: 'background 180ms',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.10)'}>
              <Icons.WhatsApp size={18} />
            </a>
            <Btn variant={dark ? 'secondaryDark' : 'secondary'} size="sm">
              Ver cases
            </Btn>
            <Btn variant="primary" size="sm" iconRight={<Icons.ArrowRight size={16}/>}>
              Agendar diagnóstico
            </Btn>
          </div>

          {/* mobile menu trigger */}
          <button className="cd-nav-mobile" onClick={() => setMenuOpen(true)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: fgStrong, padding: 8, display: 'none',
          }}>
            <Icons.Menu size={26} />
          </button>
        </div>
      </Container>

      {/* mobile drawer */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: T.deepViolet,
          display: 'flex', flexDirection: 'column',
          fontFamily: T.fontBody,
          animation: 'cd-drawer-in 220ms cubic-bezier(0.22,1,0.36,1)',
        }}>
          <div style={{
            padding: '18px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: `1px solid ${T.borderDark}`,
          }}>
            <Brand size={28} />
            <button onClick={() => setMenuOpen(false)} style={{
              background: 'transparent', border: 'none', color: T.brandTint, cursor: 'pointer', padding: 8,
            }}><Icons.X size={26} /></button>
          </div>

          <nav style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            {nav.map((n, i) => (
              <a key={n.label} href={n.href} onClick={() => setMenuOpen(false)} style={{
                color: T.brandTint, textDecoration: 'none',
                fontSize: 28, fontWeight: 500, fontFamily: T.fontDisplay,
                padding: '16px 0', borderBottom: `1px solid ${T.borderDark}`,
                letterSpacing: '-0.01em',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                animation: `cd-drawer-item ${260 + i * 50}ms cubic-bezier(0.22,1,0.36,1) both`,
              }}>
                {n.label}
                <Icons.ArrowRight size={20} style={{ color: T.brandLight }} />
              </a>
            ))}
          </nav>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Btn variant="primary" size="lg" fullWidth iconRight={<Icons.ArrowRight size={18}/>}>
              Agendar diagnóstico
            </Btn>
            <Btn variant="secondaryDark" size="md" fullWidth>
              Ver cases
            </Btn>
            <a href="#whatsapp" style={{
              marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: '14px 18px', borderRadius: 999,
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.30)',
              color: T.success, textDecoration: 'none', fontWeight: 500, fontSize: 14,
            }}>
              <Icons.WhatsApp size={18} />
              WhatsApp · resposta na hora
            </a>
          </div>
        </div>
      )}

      <style>{`
        @keyframes cd-drawer-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cd-drawer-item { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @media (max-width: 900px) {
          .cd-nav-desktop { display: none !important; }
          .cd-nav-mobile { display: inline-flex !important; }
        }
      `}</style>
    </header>
  );
}

// MOBILE HEADER — versão estática isolada (pra preview no canvas)
function HeaderMobile({ showDrawer = false }) {
  if (showDrawer) {
    const nav = ['Produto', 'Para quem é', 'Cases', 'Sobre', 'Blog'];
    return (
      <div style={{
        width: '100%', height: 812, background: T.deepViolet,
        fontFamily: T.fontBody, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${T.borderDark}`,
        }}>
          <Brand size={28} />
          <div style={{ color: T.brandTint, padding: 8 }}><Icons.X size={26}/></div>
        </div>
        <nav style={{ padding: 24 }}>
          {nav.map((label, i) => (
            <div key={label} style={{
              color: T.brandTint, fontSize: 28, fontWeight: 500, fontFamily: T.fontDisplay,
              padding: '16px 0', borderBottom: `1px solid ${T.borderDark}`,
              letterSpacing: '-0.01em',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              {label}
              <Icons.ArrowRight size={20} style={{ color: T.brandLight }} />
            </div>
          ))}
        </nav>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <Btn variant="primary" size="lg" fullWidth iconRight={<Icons.ArrowRight size={18}/>}>Agendar diagnóstico</Btn>
          <Btn variant="secondaryDark" size="md" fullWidth>Ver cases</Btn>
          <div style={{
            marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, padding: '14px 18px', borderRadius: 999,
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.30)',
            color: T.success, fontWeight: 500, fontSize: 14,
          }}>
            <Icons.WhatsApp size={18} /> WhatsApp · resposta na hora
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', background: 'rgba(26, 10, 46, 0.85)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${T.borderDark}`,
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: T.fontBody,
    }}>
      <Brand size={28} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 999,
          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: T.success,
        }}><Icons.WhatsApp size={16}/></div>
        <div style={{ color: T.brandTint, padding: 6 }}><Icons.Menu size={24}/></div>
      </div>
    </div>
  );
}

Object.assign(window, { Header, HeaderMobile });
