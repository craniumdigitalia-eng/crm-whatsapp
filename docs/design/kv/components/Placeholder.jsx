// Placeholders for sections still being built
function PlaceholderArtboard({ title, subtitle, height = 400 }) {
  return (
    <div style={{
      width: '100%',
      minHeight: height,
      background: 'repeating-linear-gradient(45deg, rgba(167,139,250,0.04) 0 12px, transparent 12px 24px), #F8F7FF',
      border: '1px dashed rgba(167,139,250,0.4)',
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 32,
      fontFamily: T.fontBody,
      color: T.brandPurple,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 999,
        background: 'rgba(124,58,237,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: T.brandPurple,
      }}>
        <Icons.Sparkles size={28} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: T.deepViolet, letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: T.fgMuted, marginTop: 6 }}>{subtitle}</div>}
        <div style={{ fontSize: 11, color: T.brandPurple, marginTop: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          ↻ Em construção
        </div>
      </div>
    </div>
  );
}

window.PlaceholderArtboard = PlaceholderArtboard;
