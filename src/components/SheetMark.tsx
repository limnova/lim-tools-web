/**
 * The brand mark: a green rounded square with a grid glyph. Kept as hand-drawn
 * SVG rather than an antd icon so it stays visually identical.
 */
export function SheetMark({ large = false }: { large?: boolean }) {
  const size = large ? 30 : 21
  return <span className={`sheet-mark${large ? ' large' : ''}`}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 3h16v18H4z M4 9h16 M4 15h16 M10 9v12" />
    </svg>
  </span>
}
