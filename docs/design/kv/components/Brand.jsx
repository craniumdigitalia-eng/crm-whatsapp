// Cranium Brand — Logo (cérebro roxo oficial), Wordmark, Brand lockup
// Logomarca: assets/cranium-brain.png (única autorizada — NÃO usar variante alvo concêntrico)

function Logo({ size = 36, color = '#A78BFA' }) {
  // Logomarca oficial Cranium — cérebro de circuito (PNG transparente do DS)
  // O `color` (palette violet/light) é aplicado como tint via mask
  return (
    <span
      role="img"
      aria-label="Cranium Digital"
      style={{
        display: 'inline-block', flexShrink: 0,
        width: size, height: size,
        background: color,
        WebkitMaskImage: 'url(assets/cranium-brain.png)',
        maskImage: 'url(assets/cranium-brain.png)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}

function Wordmark({ size = 22, dark = false }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.5em', lineHeight: 1 }}>
      <span style={{
        fontFamily: 'Geist, sans-serif',
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '0.15em',
        color: dark ? '#1A0A2E' : '#EDE9FE',
      }}>CRANIUM</span>
      <span style={{
        fontFamily: 'Geist, sans-serif',
        fontWeight: 400,
        fontSize: size * 0.5,
        letterSpacing: '0.10em',
        color: '#A78BFA',
      }}>digital</span>
    </div>
  );
}

function Brand({ size = 36, dark = false }) {
  // size = altura do wordmark; símbolo dimensiona acima disso pra equilibrar visual
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Logo size={size * 1.4} color={dark ? '#7C3AED' : '#A78BFA'} />
      <Wordmark size={size * 0.55} dark={dark} />
    </div>
  );
}

// Neural-pattern SVG bg (reusável)
function NeuralBG({ opacity = 0.18, lines = true }) {
  return (
    <svg className="cd-neural-bg" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid slice" style={{ opacity }}>
      <defs>
        <pattern id="cd-dots" width="32" height="32" patternUnits="userSpaceOnUse">
          <circle cx="16" cy="16" r="1" fill="#A78BFA" opacity="0.55"/>
        </pattern>
      </defs>
      <rect width="1280" height="800" fill="url(#cd-dots)"/>
      {lines && (
        <g stroke="#7C3AED" strokeWidth="0.6" opacity="0.5">
          <line x1="80" y1="120" x2="420" y2="280"/>
          <line x1="420" y1="280" x2="900" y2="180"/>
          <line x1="900" y1="180" x2="1180" y2="400"/>
          <line x1="420" y1="280" x2="500" y2="620"/>
          <line x1="500" y1="620" x2="200" y2="720"/>
          <line x1="900" y1="180" x2="780" y2="500"/>
          <line x1="780" y1="500" x2="1100" y2="700"/>
        </g>
      )}
    </svg>
  );
}

Object.assign(window, { Logo, Wordmark, Brand, NeuralBG });
