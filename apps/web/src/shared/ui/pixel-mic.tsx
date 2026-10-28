/** Пиксельный микрофон в стиле темы: иконка lucide не совпадает по стилю, поэтому SVG. */
export function PixelMic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} aria-hidden="true">
      <rect x="6" y="1" width="4" height="1" fill="currentColor" />
      <rect x="5" y="2" width="6" height="6" fill="currentColor" />
      <rect x="2" y="5" width="2" height="6" fill="currentColor" />
      <rect x="12" y="5" width="2" height="6" fill="currentColor" />
      <rect x="4" y="11" width="8" height="2" fill="currentColor" />
      <rect x="7" y="13" width="2" height="1" fill="currentColor" />
      <rect x="4" y="14" width="8" height="2" fill="currentColor" />
    </svg>
  );
}
