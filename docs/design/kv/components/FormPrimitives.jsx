// Form primitives — shared input/label/select/etc.

function FieldLabel({ children, required, hint }) {
  return (
    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{
        fontFamily: T.fontBody, fontSize: 13, fontWeight: 500,
        color: T.deepViolet, letterSpacing: '-0.005em',
      }}>{children}{required && <span style={{ color: T.brandPurple, marginLeft: 2 }}>*</span>}</span>
      {hint && <span style={{ fontSize: 11, color: T.fgMuted }}>{hint}</span>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', icon, error, disabled, dark }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      {icon && (
        <span style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          color: focused ? T.brandPurple : T.fgMuted,
          display: 'flex', alignItems: 'center', pointerEvents: 'none',
        }}>{icon}</span>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: icon ? '12px 16px 12px 44px' : '12px 16px',
          background: disabled ? T.surfaceLight : (dark ? 'rgba(167,139,250,0.05)' : '#fff'),
          border: `1px solid ${error ? T.brandPurple : (focused ? T.brandPurple : (dark ? T.borderDark : T.neutralMid))}`,
          borderRadius: 12,
          fontFamily: T.fontBody, fontSize: 15,
          color: disabled ? '#94A3B8' : (dark ? T.brandTint : T.deepViolet),
          outline: 'none',
          transition: 'border-color 180ms, box-shadow 180ms',
          boxShadow: focused ? `0 0 0 4px rgba(124,58,237,0.10)` : 'none',
        }}
      />
      {error && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.brandPurple }}>
          <Icons.AlertTriangle size={14}/>{error}
        </div>
      )}
    </div>
  );
}

function TextArea({ value, onChange, placeholder, rows = 4 }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '12px 16px',
        background: '#fff', border: `1px solid ${focused ? T.brandPurple : T.neutralMid}`,
        borderRadius: 12, fontFamily: T.fontBody, fontSize: 15, lineHeight: 1.5,
        color: T.deepViolet, outline: 'none', resize: 'vertical',
        transition: 'border-color 180ms, box-shadow 180ms',
        boxShadow: focused ? `0 0 0 4px rgba(124,58,237,0.10)` : 'none',
      }}
    />
  );
}

function SelectInput({ value, onChange, children }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '12px 44px 12px 16px',
          background: '#fff', border: `1px solid ${focused ? T.brandPurple : T.neutralMid}`,
          borderRadius: 12, fontFamily: T.fontBody, fontSize: 15,
          color: T.deepViolet, outline: 'none',
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
          cursor: 'pointer',
          boxShadow: focused ? `0 0 0 4px rgba(124,58,237,0.10)` : 'none',
        }}>
        {children}
      </select>
      <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: T.fgMuted, pointerEvents: 'none' }}>
        <Icons.ChevronDown size={16}/>
      </span>
    </div>
  );
}

function Checkbox({ checked, onChange, children }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: T.fgMuted, lineHeight: 1.5 }}>
      <span style={{
        width: 20, height: 20, borderRadius: 6,
        background: checked ? T.brandPurple : '#fff',
        border: `1px solid ${checked ? T.brandPurple : T.neutralMid}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flexShrink: 0, marginTop: 1,
        transition: 'background 180ms, border-color 180ms',
      }}>
        {checked && <Icons.Check size={14}/>}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}/>
      <span>{children}</span>
    </label>
  );
}

window.FieldLabel = FieldLabel;
window.TextInput = TextInput;
window.TextArea = TextArea;
window.SelectInput = SelectInput;
window.Checkbox = Checkbox;
