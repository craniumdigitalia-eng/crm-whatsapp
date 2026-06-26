// Cranium — Icon library (Lucide-style inline SVG, stroke 1.75px)
// All icons herdam currentColor

const _ico = (path, size = 20, stroke = 1.75) => ({ style, ...rest } = {}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
       style={{ flexShrink: 0, ...style }} {...rest}>
    {path}
  </svg>
);

const Icons = {
  ArrowRight:   ({ size=20, ...r }) => _ico(<><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>, size)(r),
  ArrowLeft:    ({ size=20, ...r }) => _ico(<><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>, size)(r),
  ArrowUpRight: ({ size=20, ...r }) => _ico(<><path d="M7 17 17 7"/><path d="M7 7h10v10"/></>, size)(r),
  ChevronDown:  ({ size=20, ...r }) => _ico(<path d="m6 9 6 6 6-6"/>, size)(r),
  ChevronUp:    ({ size=20, ...r }) => _ico(<path d="m18 15-6-6-6 6"/>, size)(r),
  ChevronRight: ({ size=20, ...r }) => _ico(<path d="m9 18 6-6-6-6"/>, size)(r),
  Check:        ({ size=20, ...r }) => _ico(<path d="M20 6 9 17l-5-5"/>, size)(r),
  Plus:         ({ size=20, ...r }) => _ico(<><path d="M5 12h14"/><path d="M12 5v14"/></>, size)(r),
  Minus:        ({ size=20, ...r }) => _ico(<path d="M5 12h14"/>, size)(r),
  X:            ({ size=20, ...r }) => _ico(<><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>, size)(r),
  Menu:         ({ size=20, ...r }) => _ico(<><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></>, size)(r),
  Search:       ({ size=20, ...r }) => _ico(<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>, size)(r),

  // brand / IA
  BrainCircuit: ({ size=20, ...r }) => _ico(<><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/><path d="M9 8h.01"/><path d="M15 8h.01"/></>, size)(r),
  Sparkles:     ({ size=20, ...r }) => _ico(<><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></>, size)(r),
  Bot:          ({ size=20, ...r }) => _ico(<><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></>, size)(r),
  MessageSquare:({ size=20, ...r }) => _ico(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>, size)(r),
  Cpu:          ({ size=20, ...r }) => _ico(<><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></>, size)(r),

  // contexto saude / corretor
  ShieldCheck:  ({ size=20, ...r }) => _ico(<><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></>, size)(r),
  BadgeCheck:   ({ size=20, ...r }) => _ico(<><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></>, size)(r),
  Award:        ({ size=20, ...r }) => _ico(<><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></>, size)(r),

  // tempo / urgencia
  Clock:        ({ size=20, ...r }) => _ico(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, size)(r),
  Zap:          ({ size=20, ...r }) => _ico(<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>, size)(r),
  Timer:        ({ size=20, ...r }) => _ico(<><path d="M10 2h4"/><path d="M12 14v-4"/><circle cx="12" cy="14" r="8"/></>, size)(r),

  // resultado
  TrendingUp:   ({ size=20, ...r }) => _ico(<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>, size)(r),
  BarChart:     ({ size=20, ...r }) => _ico(<><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></>, size)(r),
  Target:       ({ size=20, ...r }) => _ico(<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>, size)(r),

  // contato/canais
  Mail:         ({ size=20, ...r }) => _ico(<><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>, size)(r),
  Phone:        ({ size=20, ...r }) => _ico(<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>, size)(r),
  WhatsApp:     ({ size=20, ...r }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, ...(r.style||{}) }} {...r}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 2C6.495 2 2 6.495 2 12.05c0 1.77.464 3.498 1.343 5.022L2 22l4.992-1.327A10.005 10.005 0 0 0 12.05 22c5.555 0 10.05-4.495 10.05-10.05S17.605 2 12.05 2z"/>
    </svg>
  ),
  MapPin:       ({ size=20, ...r }) => _ico(<><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8"/><circle cx="12" cy="10" r="3"/></>, size)(r),
  Globe:        ({ size=20, ...r }) => _ico(<><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></>, size)(r),
  Building:     ({ size=20, ...r }) => _ico(<><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M2 22h20"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></>, size)(r),
  Users:        ({ size=20, ...r }) => _ico(<><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>, size)(r),
  User:         ({ size=20, ...r }) => _ico(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>, size)(r),

  // alerts
  AlertTriangle:({ size=20, ...r }) => _ico(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>, size)(r),
  Info:         ({ size=20, ...r }) => _ico(<><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></>, size)(r),
  CheckCircle:  ({ size=20, ...r }) => _ico(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></>, size)(r),

  // ui
  Calendar:     ({ size=20, ...r }) => _ico(<><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></>, size)(r),
  Download:     ({ size=20, ...r }) => _ico(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></>, size)(r),
  Play:         ({ size=20, ...r }) => _ico(<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>, size)(r),
  Star:         ({ size=20, ...r }) => _ico(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>, size)(r),
  Quote:        ({ size=20, ...r }) => _ico(<><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></>, size)(r),
  ExternalLink: ({ size=20, ...r }) => _ico(<><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>, size)(r),
  Filter:       ({ size=20, ...r }) => _ico(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>, size)(r),
  Tag:          ({ size=20, ...r }) => _ico(<><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></>, size)(r),
  Send:         ({ size=20, ...r }) => _ico(<><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>, size)(r),
  Paperclip:    ({ size=20, ...r }) => _ico(<path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.99 8.83l-8.61 8.6a2 2 0 0 1-2.83-2.83l8.49-8.48"/>, size)(r),
  Loader:       ({ size=20, ...r }) => _ico(<><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></>, size)(r),

  // problema
  XCircle:      ({ size=20, ...r }) => _ico(<><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></>, size)(r),
  ClockAlert:   ({ size=20, ...r }) => _ico(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/><path d="M19 5v2"/><path d="M19 9h.01"/></>, size)(r),

  // social
  Instagram:    ({ size=20, ...r }) => _ico(<><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></>, size)(r),
  Linkedin:     ({ size=20, ...r }) => _ico(<><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></>, size)(r),
  Youtube:      ({ size=20, ...r }) => _ico(<><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z" fill="currentColor"/></>, size)(r),
};

window.Icons = Icons;
