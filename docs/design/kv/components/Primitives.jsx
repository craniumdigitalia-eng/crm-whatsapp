// Cranium Web — Shared primitives + design tokens as JS constants
// Use these to avoid hardcoded hex everywhere. They reflect tokens.css

const T = {
  // brand
  deepViolet: '#1A0A2E',
  brandDark:  '#2D0F52',
  brandPurple:'#7C3AED',
  brandPurpleHover: '#6D28D9',
  brandLight: '#A78BFA',
  brandTint:  '#EDE9FE',
  // neutrals
  offWhite:   '#F8F7FF',
  surfaceLight:'#F5F3FF',
  neutralDark:'#0F172A',
  neutralMid: '#E2E8F0',
  neutralSoft:'#C4B0F0',
  fgMuted:    '#475569',
  // borders
  borderDark: 'rgba(167,139,250,0.18)',
  // semantic
  success:    '#10B981',
  errorFg:    '#7C3AED',
  // type
  fontDisplay:'Geist, "Plus Jakarta Sans", system-ui, sans-serif',
  fontBody:   'Geist, "Inter", system-ui, sans-serif',
  fontMono:   '"Geist Mono", ui-monospace, monospace',
};

/* ============================================================
   Buttons — 5 variants
   ============================================================ */

function Btn({ children, variant = 'primary', size = 'md', icon, iconRight, onClick, fullWidth, disabled, style: extra }) {
  const sizes = {
    sm: { padX: 14, padY: 9,  font: 13 },
    md: { padX: 22, padY: 13, font: 15 },
    lg: { padX: 28, padY: 16, font: 16 },
  }[size];

  const variants = {
    primary: {
      background: T.brandPurple, color: '#fff', border: 'none',
      boxShadow: '0 12px 32px -8px rgba(124,58,237,0.45)',
    },
    secondary: {
      background: 'transparent', color: T.neutralDark,
      border: `1px solid ${T.neutralMid}`,
    },
    secondaryDark: {
      background: 'transparent', color: T.brandTint,
      border: `1px solid ${T.borderDark}`,
    },
    ghost: {
      background: 'transparent', color: T.brandPurple,
      border: 'none', boxShadow: 'none',
    },
    text: {
      background: 'transparent', color: T.brandPurple,
      border: 'none', padding: 0, boxShadow: 'none',
    },
  }[variant];

  const isText = variant === 'text';
  const padding = isText ? 0 : `${sizes.padY}px ${sizes.padX}px`;

  return (
    <button onClick={onClick} disabled={disabled} className="cd-btn-base"
      style={{
        fontFamily: T.fontBody,
        fontWeight: 500,
        fontSize: sizes.font,
        lineHeight: 1,
        padding,
        borderRadius: isText ? 0 : 999,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 180ms cubic-bezier(0.22,1,0.36,1), transform 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 180ms cubic-bezier(0.22,1,0.36,1)',
        width: fullWidth ? '100%' : 'auto',
        justifyContent: fullWidth ? 'center' : 'flex-start',
        ...variants,
        ...extra,
      }}>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
      {iconRight && <span style={{ display: 'inline-flex' }}>{iconRight}</span>}
    </button>
  );
}

/* ============================================================
   Eyebrow
   ============================================================ */

function Eyebrow({ children, dark, color }) {
  return (
    <div style={{
      fontFamily: T.fontBody,
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: color || (dark ? T.brandLight : T.brandPurple),
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{ width: 24, height: 1, background: 'currentColor', opacity: 0.5 }} />
      {children}
    </div>
  );
}

/* ============================================================
   Heading helpers
   ============================================================ */

function H1({ children, dark, style }) {
  return (
    <h1 style={{
      fontFamily: T.fontDisplay,
      fontWeight: 600,
      fontSize: 'clamp(36px, 4.5vw, 64px)',
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      color: dark ? T.brandTint : T.deepViolet,
      margin: 0,
      textWrap: 'balance',
      ...style,
    }}>{children}</h1>
  );
}
function H2({ children, dark, style }) {
  return (
    <h2 style={{
      fontFamily: T.fontDisplay,
      fontWeight: 600,
      fontSize: 'clamp(28px, 3vw, 44px)',
      lineHeight: 1.1,
      letterSpacing: '-0.015em',
      color: dark ? T.brandTint : T.deepViolet,
      margin: 0,
      textWrap: 'balance',
      ...style,
    }}>{children}</h2>
  );
}
function H3({ children, dark, style }) {
  return (
    <h3 style={{
      fontFamily: T.fontDisplay,
      fontWeight: 600,
      fontSize: 20,
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
      color: dark ? T.brandTint : T.deepViolet,
      margin: 0,
      ...style,
    }}>{children}</h3>
  );
}

function Lead({ children, dark, style }) {
  return (
    <p style={{
      fontFamily: T.fontBody,
      fontWeight: 400,
      fontSize: 'clamp(17px, 1.3vw, 20px)',
      lineHeight: 1.5,
      color: dark ? T.neutralSoft : T.fgMuted,
      margin: 0,
      textWrap: 'pretty',
      ...style,
    }}>{children}</p>
  );
}

function Body({ children, dark, sm, style }) {
  return (
    <p style={{
      fontFamily: T.fontBody,
      fontWeight: 400,
      fontSize: sm ? 14 : 16,
      lineHeight: 1.65,
      color: dark ? T.neutralSoft : T.fgMuted,
      margin: 0,
      textWrap: 'pretty',
      ...style,
    }}>{children}</p>
  );
}

/* ============================================================
   Badge / Pill
   ============================================================ */
function Pill({ children, dark, dot, color, style }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      borderRadius: 999,
      background: dark ? 'rgba(167,139,250,0.10)' : T.brandTint,
      border: dark ? '1px solid rgba(167,139,250,0.25)' : '1px solid rgba(124,58,237,0.15)',
      color: dark ? T.brandLight : T.brandPurple,
      fontFamily: T.fontBody,
      fontWeight: 500,
      fontSize: 11,
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: color || T.success }} />}
      {children}
    </span>
  );
}

/* ============================================================
   Container
   ============================================================ */
function Container({ children, max = 1280, padX = 32, style }) {
  return (
    <div style={{
      maxWidth: max,
      margin: '0 auto',
      paddingLeft: padX, paddingRight: padX,
      width: '100%',
      ...style,
    }}>{children}</div>
  );
}

Object.assign(window, { T, Btn, Eyebrow, H1, H2, H3, Lead, Body, Pill, Container });
