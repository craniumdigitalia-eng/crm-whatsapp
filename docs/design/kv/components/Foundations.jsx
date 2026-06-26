// Foundations — Web extensions of the Cranium DS
// Two artboards: Colors (with semantic states) + Type scale

function ColorSwatch({ name, hex, fg = '#0F172A', usage, big }) {
  return (
    <div style={{
      background: hex,
      borderRadius: 14,
      padding: big ? 24 : 18,
      minHeight: big ? 140 : 110,
      border: hex === '#F8F7FF' || hex === '#F5F3FF' || hex === '#EDE9FE' ? '1px solid #E2E8F0' : 'none',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      color: fg,
      fontFamily: T.fontBody,
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>{name}</div>
        {usage && <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>{usage}</div>}
      </div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 12, fontWeight: 500,
        opacity: 0.7, letterSpacing: '0.02em',
      }}>{hex}</div>
    </div>
  );
}

function FoundationColors() {
  return (
    <div style={{ background: T.offWhite, padding: 40, fontFamily: T.fontBody, color: T.neutralDark, minHeight: 1000 }}>
      <Eyebrow>01 — Foundations · Cores web</Eyebrow>
      <h2 style={{ fontFamily: T.fontDisplay, fontSize: 32, fontWeight: 600, margin: '12px 0 8px', letterSpacing: '-0.02em' }}>
        Paleta web (herança do DS + estados específicos).
      </h2>
      <p style={{ fontSize: 15, color: T.fgMuted, margin: '0 0 32px', maxWidth: 700, lineHeight: 1.6 }}>
        100% das cores vêm do Design System base. Estados semânticos foram desenhados
        sem usar quente (sem vermelho de erro, sem amber de warning) — resolve com violeta + ícone.
      </p>

      {/* Brand */}
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.brandPurple, marginBottom: 12 }}>
        Brand — herança direta do DS
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
        <ColorSwatch name="Deep Violet" hex="#1A0A2E" fg="#EDE9FE" usage="bg principal escuro" />
        <ColorSwatch name="Brand Dark"  hex="#2D0F52" fg="#EDE9FE" usage="cards de destaque" />
        <ColorSwatch name="Brand Purple" hex="#7C3AED" fg="#fff" usage="CTA, ícone ativo" />
        <ColorSwatch name="Brand Light" hex="#A78BFA" fg="#1A0A2E" usage="hover dark, 'digital'" />
        <ColorSwatch name="Brand Tint"  hex="#EDE9FE" fg="#2D0F52" usage="bg claro c/ identidade" />
      </div>

      {/* Neutrals */}
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.brandPurple, marginBottom: 12 }}>
        Neutros — herança DS
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
        <ColorSwatch name="Off-white" hex="#F8F7FF" fg="#1A0A2E" usage="bg principal claro" />
        <ColorSwatch name="Surface Light" hex="#F5F3FF" fg="#1A0A2E" usage="bg alternativo" />
        <ColorSwatch name="Neutral Mid" hex="#E2E8F0" fg="#0F172A" usage="bordas, divisores" />
        <ColorSwatch name="Neutral Dark" hex="#0F172A" fg="#EDE9FE" usage="texto em claro" />
        <ColorSwatch name="Neutral Soft" hex="#C4B0F0" fg="#1A0A2E" usage="texto sec. em dark" />
      </div>

      {/* Semantic */}
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.brandPurple, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        Semânticos — extensão web · <span style={{ color: T.fgMuted, fontSize: 10, letterSpacing: 0, textTransform: 'none', fontWeight: 400 }}>(sem quente, mantém regra do DS)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        <div>
          <ColorSwatch name="Success" hex="#10B981" fg="#fff" usage="confirmação, online" />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.30)', borderRadius: 10, color: T.success, fontSize: 13 }}>
            <Icons.CheckCircle size={16} />
            Form enviado com sucesso
          </div>
        </div>
        <div>
          <ColorSwatch name="Error (violet)" hex="#7C3AED" fg="#fff" usage="erro sem vermelho" />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.30)', borderRadius: 10, color: T.brandPurple, fontSize: 13 }}>
            <Icons.AlertTriangle size={16} />
            Verifique seu e-mail
          </div>
        </div>
        <div>
          <ColorSwatch name="Warning" hex="#A78BFA" fg="#1A0A2E" usage="reuso brand-light" />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.30)', borderRadius: 10, color: T.brandPurple, fontSize: 13 }}>
            <Icons.AlertTriangle size={16} />
            Faltam 2 minutos
          </div>
        </div>
        <div>
          <ColorSwatch name="Info" hex="#A78BFA" fg="#1A0A2E" usage="dicas, tooltips" />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.30)', borderRadius: 10, color: T.brandPurple, fontSize: 13 }}>
            <Icons.Info size={16} />
            IA pode demorar até 4s
          </div>
        </div>
      </div>

      {/* Hover states */}
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.brandPurple, marginBottom: 12 }}>
        Estados de interação — extensão web
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <ColorSwatch name="Btn hover" hex="#6D28D9" fg="#fff" usage="–6% luminância" />
        <ColorSwatch name="Link hover (light)" hex="#6D28D9" fg="#fff" usage="+ underline 1px" />
        <ColorSwatch name="Card hover border" hex="#A78BFA" fg="#1A0A2E" usage="40% opacity" />
        <ColorSwatch name="Disabled bg" hex="#F5F3FF" fg="#94A3B8" usage="+ fg #94A3B8" />
      </div>
    </div>
  );
}

function TypeRow({ label, sample, font = T.fontDisplay, weight, size, lineHeight = 1.1, tracking = '-0.02em', color = T.deepViolet }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px 100px 1fr',
      gap: 24, alignItems: 'baseline',
      padding: '20px 0', borderBottom: '1px solid #E2E8F0',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.deepViolet }}>{label}</div>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fgMuted, marginTop: 2 }}>{`${size}px / ${weight}`}</div>
      </div>
      <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fgMuted, lineHeight: 1.4 }}>
        lh {lineHeight}<br/>
        tr {tracking}
      </div>
      <div style={{
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        lineHeight,
        letterSpacing: tracking,
        color,
      }}>{sample}</div>
    </div>
  );
}

function FoundationType() {
  return (
    <div style={{ background: T.offWhite, padding: 40, fontFamily: T.fontBody, color: T.neutralDark, minHeight: 1000 }}>
      <Eyebrow>01 — Foundations · Tipografia web</Eyebrow>
      <h2 style={{ fontFamily: T.fontDisplay, fontSize: 32, fontWeight: 600, margin: '12px 0 8px', letterSpacing: '-0.02em' }}>
        Geist + Geist Mono. Mesma família do DS, escala estendida pra web.
      </h2>
      <p style={{ fontSize: 15, color: T.fgMuted, margin: '0 0 32px', maxWidth: 700, lineHeight: 1.6 }}>
        Trackings: <code style={{ fontFamily: T.fontMono, background: T.brandTint, padding: '2px 6px', borderRadius: 4 }}>–0.02em</code> em
        headlines (Geist gosta apertado) · <code style={{ fontFamily: T.fontMono, background: T.brandTint, padding: '2px 6px', borderRadius: 4 }}>+0.08em</code> em
        labels uppercase · <code style={{ fontFamily: T.fontMono, background: T.brandTint, padding: '2px 6px', borderRadius: 4 }}>+0.15em</code> no wordmark.
      </p>

      <TypeRow label="Hero (wide)" sample="Você tem SUSEP. Agora tem IA também." weight={600} size={88} />
      <TypeRow label="Hero" sample="Seu lead não pode esperar. A nossa IA não deixa." weight={600} size={72} />
      <TypeRow label="H1" sample="Atende, qualifica, converte." weight={600} size={56} />
      <TypeRow label="H2" sample="Inteligência de quem vive o mercado." weight={600} size={40} tracking="-0.015em" />
      <TypeRow label="H3" sample="Criado por dentro. Pensado pro seu resultado." weight={600} size={24} tracking="-0.01em" lineHeight={1.2} />
      <TypeRow label="Lead" sample="Agência de marketing com IA para corretores de plano de saúde." weight={400} size={20} tracking="-0.005em" lineHeight={1.5} color={T.fgMuted} font={T.fontBody} />
      <TypeRow label="Body (blog)" sample="Sabe por que o lead some? Resposta demorou 4h." weight={400} size={17} tracking="0" lineHeight={1.75} color={T.neutralDark} font={T.fontBody} />
      <TypeRow label="Body (UI)" sample="A IA responde o lead em segundos. Você fecha o plano." weight={400} size={16} tracking="0" lineHeight={1.65} color={T.fgMuted} font={T.fontBody} />
      <TypeRow label="Body sm" sample="Pessoa física, PME ou adesão por entidade?" weight={400} size={14} tracking="0" lineHeight={1.5} color={T.fgMuted} font={T.fontBody} />
      <TypeRow label="Label" sample="RESULTADO MÉDIO · 90 DIAS" weight={500} size={11} tracking="0.10em" lineHeight={1.2} color={T.brandPurple} font={T.fontBody} />
      <TypeRow label="Mono · stats" sample="312% · R$ 1.847,00 · SUSEP 12345" weight={500} size={15} tracking="0" lineHeight={1.4} color={T.deepViolet} font={T.fontMono} />
      <TypeRow label="Stat XL" sample="+312%" weight={600} size={96} tracking="-0.04em" lineHeight={1} color={T.deepViolet} font={T.fontDisplay} />
    </div>
  );
}

Object.assign(window, { FoundationColors, FoundationType });
