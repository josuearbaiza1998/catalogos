// Íconos de trazo (24×24, estilo Lucide) dibujados inline para no añadir dependencias.
type P = { className?: string; size?: number };

function Svg({ className, size = 16, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

export const IconPanelLeft = (p: P) => (<Svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18" /></Svg>);
export const IconPanelRight = (p: P) => (<Svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M15 3v18" /></Svg>);
export const IconUpload = (p: P) => (<Svg {...p}><path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" /></Svg>);
export const IconImage = (p: P) => (<Svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-4.5-4.5L6 21" /></Svg>);
export const IconSheet = (p: P) => (<Svg {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M4 15h16M10 3v18" /></Svg>);
export const IconSearch = (p: P) => (<Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>);
export const IconX = (p: P) => (<Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>);
export const IconCloud = (p: P) => (<Svg {...p}><path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12 3.5 3.5 0 0 0 6 19z" /></Svg>);
export const IconCloudOff = (p: P) => (<Svg {...p}><path d="m2 2 20 20" /><path d="M5.8 8.4A6 6 0 0 0 4.5 12 3.5 3.5 0 0 0 6 19h11" /><path d="M21.3 16.7a4.5 4.5 0 0 0-5.2-6.5 6 6 0 0 0-5.6-3.9" /></Svg>);
export const IconCheck = (p: P) => (<Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>);
export const IconEye = (p: P) => (<Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>);
export const IconShare = (p: P) => (<Svg {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></Svg>);
export const IconTrash = (p: P) => (<Svg {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Svg>);
export const IconPlus = (p: P) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const IconMinus = (p: P) => (<Svg {...p}><path d="M5 12h14" /></Svg>);
export const IconMaximize = (p: P) => (<Svg {...p}><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></Svg>);
export const IconRefresh = (p: P) => (<Svg {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></Svg>);
export const IconSparkles = (p: P) => (<Svg {...p}><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></Svg>);
export const IconDownload = (p: P) => (<Svg {...p}><path d="M12 4v12" /><path d="m6 10 6 6 6-6" /><path d="M4 20h16" /></Svg>);
export const IconLink = (p: P) => (<Svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Svg>);
export const IconStar = (p: P) => (<Svg {...p}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></Svg>);
export const IconAlert = (p: P) => (<Svg {...p}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></Svg>);
export const IconWhatsapp = (p: P) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="currentColor" className={p.className} aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.3z" />
  </svg>
);
