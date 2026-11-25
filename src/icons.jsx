// Íconos simples de línea (en vez de emojis), heredan el color del texto.
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const IconCheck = (p) => (
  <svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
export const IconDots = (p) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
)
export const IconGrip = (p) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
  </svg>
)
export const IconPencil = (p) => (
  <svg {...base} {...p}><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
)
export const IconTrash = (p) => (
  <svg {...base} {...p}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></svg>
)
export const IconMove = (p) => (
  <svg {...base} {...p}><path d="M4 12h14" /><path d="M13 6l6 6-6 6" /></svg>
)
export const IconBack = (p) => (
  <svg {...base} {...p}><path d="M15 6l-6 6 6 6" /></svg>
)
export const IconShare = (p) => (
  <svg {...base} {...p}><path d="M12 15V4" /><path d="M7.5 8.5L12 4l4.5 4.5" /><path d="M5 13v6h14v-6" /></svg>
)
export const IconPlus = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconSort = (p) => (
  <svg {...base} {...p}><path d="M7 4v16M4 17l3 3 3-3" /><path d="M14 6h6M14 12h4M14 18h2" /></svg>
)
export const IconRefresh = (p) => (
  <svg {...base} {...p}><path d="M20 12a8 8 0 1 1-2.4-5.7" /><path d="M20 4v5h-5" /></svg>
)
export const IconSettings = (p) => (
  <svg {...base} {...p}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" />
  </svg>
)
export const IconHistory = (p) => (
  <svg {...base} {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3 4v4h4" /><path d="M12 8v4.5l3 2" />
  </svg>
)
export const IconInvite = (p) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
    <path d="M19 8v6M16 11h6" />
  </svg>
)
export const IconShareNodes = (p) => (
  <svg {...base} {...p}>
    <circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" />
    <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
  </svg>
)
export const IconExport = (p) => (
  <svg {...base} {...p}>
    <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" /><path d="M13.5 3.5V9H19" />
    <path d="M12 17.5v-6M9.5 14L12 11.5 14.5 14" />
  </svg>
)
export const IconPrint = (p) => (
  <svg {...base} {...p}>
    <path d="M7 9V4h10v5" /><rect x="3.5" y="9" width="17" height="7.5" rx="2" />
    <path d="M7 14h10v6H7z" />
  </svg>
)
