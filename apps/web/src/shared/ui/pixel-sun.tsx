export function PixelSun({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} aria-hidden="true">
      <rect x="6" y="1" width="4" height="2" fill="currentColor" />
      <rect x="6" y="13" width="4" height="2" fill="currentColor" />
      <rect x="1" y="6" width="2" height="4" fill="currentColor" />
      <rect x="13" y="6" width="2" height="4" fill="currentColor" />
      <rect x="2" y="2" width="2" height="2" fill="currentColor" />
      <rect x="12" y="2" width="2" height="2" fill="currentColor" />
      <rect x="2" y="12" width="2" height="2" fill="currentColor" />
      <rect x="12" y="12" width="2" height="2" fill="currentColor" />
      <rect x="4" y="4" width="8" height="8" fill="currentColor" />
    </svg>
  );
}
