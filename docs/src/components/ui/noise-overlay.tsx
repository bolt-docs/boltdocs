const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <filter id="n">
    <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
    <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 3 -1.2"/>
  </filter>
  <rect width="100%" height="100%" filter="url(#n)" opacity="1"/>
</svg>`

export function NoiseOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(SVG)}")`,
        backgroundSize: '128px 128px',
        opacity: 0.05,
      }}
    />
  )
}
