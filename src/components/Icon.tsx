import type { CSSProperties } from 'react'

const paths = {
  sheet: 'M4 3h16v18H4z M4 9h16 M4 15h16 M10 9v12',
  plus: 'M12 5v14 M5 12h14',
  back: 'M19 12H5 M11 6l-6 6 6 6',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  upload: 'M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5',
  download: 'M12 3v13 M7 11l5 5 5-5 M4 16v5h16v-5',
  check: 'M5 12l4 4L19 6',
  clock: 'M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  help: 'M9 9a3 3 0 1 1 4 3v2 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  close: 'M6 6l12 12 M18 6L6 18',
  refresh: 'M20 7a9 9 0 1 0 1 8 M20 3v5h-5',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
} as const

export function Icon({ name, size = 18, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true"><path d={paths[name]} /></svg>
}

export function SheetMark({ large = false }: { large?: boolean }) {
  return <span className={`sheet-mark${large ? ' large' : ''}`}><Icon name="sheet" size={large ? 30 : 21} /></span>
}
