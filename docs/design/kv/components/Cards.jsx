// 4 Card types — Blog, Produto, Case, Pessoa

function avatarColor(s) {
  const colors = [T.brandPurple, T.brandLight, '#5B21B6', '#7C3AED'];
  return colors[(s || '').charCodeAt(0) % colors.length];
}

/* ============================================================
   CARD BLOG
   ============================================================ */
function CardBlog({ tag = 'Estratégia', title, excerpt, author = 'Bruno de Castro', date = '12 mar 2026', read = '4 min', cover }) {
  return (
    <article style={{
      background: '#fff', border: `1px solid ${T.neutralMid}`, borderRadius: 20,
      overflow: 'hidden', fontFamily: T.fontBody,
      transition: 'transform 220ms, border-color 220ms, box-shadow 220ms',
      cursor: 'pointer', display: 'flex', flexDirection: 'column',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; e.currentTarget.style.boxShadow = '0 16px 32px -12px rgba(124,58,237,0.18)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = T.neutralMid; e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{
        aspectRatio: '16/10',
        background: cover || `linear-gradient(135deg, ${T.deepViolet} 0%, ${T.brandPurple} 100%)`,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 16, left: 16,
          padding: '4px 10px', borderRadius: 999,
          background: 'rgba(248,247,255,0.92)',
          backdropFilter: 'blur(8px)',
          fontSize: 11, fontWeight: 500,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: T.brandPurple,
        }}>{tag}</div>
        <NeuralBG opacity={0.20} lines={false}/>
      </div>
      <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 20, letterSpacing: '-0.015em', color: T.deepViolet, lineHeight: 1.25, margin: 0, textWrap: 'balance' }}>{title || 'O lead perdido custa mais que o lead conquistado'}</h3>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: T.fgMuted, margin: 0, textWrap: 'pretty' }}>{excerpt || 'Por que respostas em < 1h dobram conversão e o que a IA muda nessa equação — com cálculo de ROI.'}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${T.neutralMid}` }}>
          <div style={{ width: 28, height: 28, borderRadius: 999, background: avatarColor(author), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600 }}>
            {author[0]}
          </div>
          <span style={{ fontSize: 13, color: T.deepViolet, fontWeight: 500 }}>{author}</span>
          <span style={{ color: T.fgMuted, fontSize: 12 }}>·</span>
          <span style={{ fontSize: 12, color: T.fgMuted, fontFamily: T.fontMono }}>{date}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: T.fgMuted, fontFamily: T.fontMono }}>{read}</span>
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   CARD PRODUTO (feature/módulo)
   ============================================================ */
function CardProduct({ icon = <Icons.Bot size={22}/>, name, tagline, price, status = 'ativo' }) {
  return (
    <article style={{
      background: T.deepViolet, color: T.brandTint,
      border: `1px solid ${T.borderDark}`, borderRadius: 20,
      padding: 28, fontFamily: T.fontBody,
      position: 'relative', overflow: 'hidden',
      transition: 'transform 220ms, border-color 220ms',
      cursor: 'pointer',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = T.borderDark; }}>
      <NeuralBG opacity={0.10} lines={false}/>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'rgba(124,58,237,0.20)', color: T.brandLight,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{icon}</div>
          <span style={{
            padding: '4px 10px', borderRadius: 999,
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
            color: T.success, fontSize: 10, fontWeight: 500,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span className="cd-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: T.success }}/>
            {status}
          </span>
        </div>
        <div>
          <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 22, letterSpacing: '-0.015em', margin: '0 0 4px', lineHeight: 1.2 }}>{name || 'Cranium IA'}</h3>
          <p style={{ fontSize: 14, color: T.neutralSoft, margin: 0, lineHeight: 1.55 }}>{tagline || 'Atende, qualifica e converte leads de plano de saúde 24/7.'}</p>
        </div>
        <div style={{
          padding: '14px 0 0',
          borderTop: `1px solid ${T.borderDark}`,
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        }}>
          <div>
            <div className="cd-tnum" style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 24, color: T.brandTint, letterSpacing: '-0.01em' }}>{price || 'Sob consulta'}</div>
            <div style={{ fontSize: 11, color: T.brandLight, letterSpacing: '0.04em', fontFamily: T.fontMono }}>setup + mensal · sem fidelidade</div>
          </div>
          <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.brandLight, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            Ver mais <Icons.ArrowRight size={14}/>
          </a>
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   CARD CASE (resultado real)
   ============================================================ */
function CardCase({ corretora, regiao, foto, stat, statLabel, summary, vidas }) {
  return (
    <article style={{
      background: '#fff', border: `1px solid ${T.neutralMid}`, borderRadius: 20,
      overflow: 'hidden', fontFamily: T.fontBody,
      transition: 'transform 220ms, border-color 220ms, box-shadow 220ms',
      cursor: 'pointer', display: 'flex', flexDirection: 'column',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; e.currentTarget.style.boxShadow = '0 16px 32px -12px rgba(124,58,237,0.18)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = T.neutralMid; e.currentTarget.style.boxShadow = 'none'; }}>
      {/* Photo header */}
      <div style={{
        aspectRatio: '16/9',
        background: foto || `linear-gradient(135deg, ${T.brandDark}, ${T.brandPurple})`,
        position: 'relative',
        display: 'flex', alignItems: 'flex-end', padding: 24,
      }}>
        <div style={{
          background: 'rgba(26,10,46,0.78)', backdropFilter: 'blur(14px)',
          border: `1px solid ${T.borderDark}`, borderRadius: 12,
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.brandPurple, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Icons.Building size={16}/>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: T.brandTint }}>{corretora || 'Corretora Saúde+'}</div>
            <div style={{ fontSize: 11, color: T.brandLight, fontFamily: T.fontMono }}>{regiao || 'Belo Horizonte · MG'}</div>
          </div>
        </div>
      </div>
      <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div className="cd-tnum" style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 48, color: T.brandPurple, letterSpacing: '-0.04em', lineHeight: 1 }}>{stat || '+240%'}</div>
          <div style={{ fontSize: 13, color: T.fgMuted, lineHeight: 1.4 }}>{statLabel || 'leads qualificados\nem 90 dias'}</div>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: T.fgMuted, margin: 0 }}>
          "{summary || 'A IA atende lead de domingo de manhã. Antes a gente nem via — agora vira reunião.'}"
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${T.neutralMid}`,
        }}>
          <span style={{ fontSize: 12, color: T.fgMuted, fontFamily: T.fontMono }}>{vidas || '+ 187 vidas/mês'} fechadas via IA</span>
          <a href="#" style={{ color: T.brandPurple, fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            Ler case <Icons.ArrowRight size={14}/>
          </a>
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   CARD PESSOA (time/depoimento)
   ============================================================ */
function CardPerson({ name = 'Bruno de Castro', role = 'Fundador · CEO', bio, susep = '10.2024.847291' }) {
  return (
    <article style={{
      background: '#fff', border: `1px solid ${T.neutralMid}`, borderRadius: 20,
      padding: 28, fontFamily: T.fontBody,
      transition: 'transform 220ms, border-color 220ms',
      cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 18,
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = T.neutralMid; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999,
          background: avatarColor(name),
          backgroundImage: name === 'Bruno de Castro' ? 'url(assets/bruno.jpg)' : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 22,
          flexShrink: 0,
        }}>{name === 'Bruno de Castro' ? '' : name[0]}</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 18, color: T.deepViolet, margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{name}</h3>
          <div style={{ fontSize: 13, color: T.brandPurple, marginTop: 2 }}>{role}</div>
        </div>
      </div>

      {/* SUSEP badge */}
      <div style={{
        padding: '10px 14px',
        background: T.brandTint,
        border: '1px solid rgba(124,58,237,0.18)',
        borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Icons.ShieldCheck size={16} style={{ color: T.brandPurple }}/>
        <div>
          <div style={{ fontSize: 11, color: T.brandPurple, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>SUSEP ativa</div>
          <div className="cd-tnum" style={{ fontSize: 13, color: T.deepViolet, fontFamily: T.fontMono, marginTop: 2 }}>{susep}</div>
        </div>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.6, color: T.fgMuted, margin: 0 }}>
        {bio || '6 anos vendendo plano de saúde antes de fundar a Cranium. PME, PF, adesão por entidade — viveu o problema antes de construir a solução.'}
      </p>

      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: `1px solid ${T.neutralMid}` }}>
        <a href="#" style={iconLinkStyle}><Icons.Linkedin size={14}/></a>
        <a href="#" style={iconLinkStyle}><Icons.Instagram size={14}/></a>
        <a href="#" style={iconLinkStyle}><Icons.Mail size={14}/></a>
        <a href="#" style={{ ...iconLinkStyle, marginLeft: 'auto', width: 'auto', padding: '0 14px', fontSize: 13, fontWeight: 500 }}>
          Conhecer <Icons.ArrowRight size={12}/>
        </a>
      </div>
    </article>
  );
}
const iconLinkStyle = {
  width: 32, height: 32, borderRadius: 999,
  background: T.surfaceLight, color: T.brandPurple,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  textDecoration: 'none', gap: 6,
  transition: 'background 180ms',
};

function Cards() {
  return (
    <div style={{ background: '#f0eee9', padding: 40 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 32 }}>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.brandPurple, fontWeight: 600, marginBottom: 12 }}>CARD 01 · Blog</div>
          <CardBlog/>
        </div>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.brandPurple, fontWeight: 600, marginBottom: 12 }}>CARD 02 · Produto</div>
          <CardProduct/>
        </div>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.brandPurple, fontWeight: 600, marginBottom: 12 }}>CARD 03 · Case</div>
          <CardCase/>
        </div>
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.brandPurple, fontWeight: 600, marginBottom: 12 }}>CARD 04 · Pessoa</div>
          <CardPerson/>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CardBlog, CardProduct, CardCase, CardPerson, Cards });
