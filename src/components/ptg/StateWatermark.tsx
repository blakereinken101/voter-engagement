'use client'

/**
 * Renders a subtle, layered SVG watermark behind the PTG header area
 * based on the campaign's state. Enhanced with detailed, realistic
 * multi-path illustrations and a vertical fade mask.
 */

interface StateIcon {
  viewBox: string
  paths: { d: string; strokeWidth?: number; opacity?: number; fill?: boolean }[]
}

const STATE_ICONS: Record<string, StateIcon> = {
  // Mountains (Alaska / Denali range) — layered peaks with snowcaps
  AK: {
    viewBox: '0 0 200 100',
    paths: [
      // Far background range
      { d: 'M0 90 L15 70 L30 78 L50 55 L65 72 L80 48 L95 65 L110 42 L125 60 L140 50 L160 68 L175 58 L200 90 Z', strokeWidth: 1.5, opacity: 0.3 },
      // Mid-range peaks
      { d: 'M0 90 L25 60 L40 72 L55 38 L70 58 L90 28 L105 52 L120 35 L135 55 L155 42 L170 62 L185 50 L200 90 Z', strokeWidth: 2, opacity: 0.6 },
      // Foreground main peaks
      { d: 'M0 90 L20 68 L35 78 L50 50 L60 62 L75 30 L90 55 L100 20 L115 55 L130 40 L145 60 L160 45 L175 65 L190 55 L200 90 Z', strokeWidth: 2.5, opacity: 1 },
      // Snowcap details on tallest peaks
      { d: 'M75 30 L70 38 L80 36 Z M100 20 L94 30 L106 28 Z M130 40 L125 48 L135 46 Z', strokeWidth: 1, opacity: 0.8, fill: true },
      // Base horizon line
      { d: 'M0 90 L200 90', strokeWidth: 1.5, opacity: 0.4 },
    ],
  },
  // Saguaro Cactus (Arizona) — detailed with arms and ribs
  AZ: {
    viewBox: '0 0 120 140',
    paths: [
      // Main trunk
      { d: 'M55 130 L55 40 Q55 25 60 25 Q65 25 65 40 L65 130', strokeWidth: 2.5, opacity: 1 },
      // Left arm
      { d: 'M55 65 L40 65 Q30 65 30 55 L30 45 Q30 35 35 35 Q40 35 40 45 L40 55', strokeWidth: 2, opacity: 0.9 },
      // Right arm (higher)
      { d: 'M65 50 L80 50 Q90 50 90 40 L90 30 Q90 20 85 20 Q80 20 80 30 L80 40', strokeWidth: 2, opacity: 0.9 },
      // Small right arm (lower)
      { d: 'M65 80 L75 80 Q82 80 82 72 L82 65 Q82 58 78 58 Q74 58 74 65 L74 72', strokeWidth: 1.5, opacity: 0.7 },
      // Vertical rib lines on trunk
      { d: 'M58 35 L58 125 M62 35 L62 125', strokeWidth: 0.8, opacity: 0.3 },
      // Desert ground
      { d: 'M10 130 Q30 126 60 130 Q90 134 110 130', strokeWidth: 1.5, opacity: 0.4 },
      // Small background cactus
      { d: 'M15 130 L15 110 Q15 105 17 105 Q19 105 19 110 L19 130 M15 115 L10 115 L10 110', strokeWidth: 1, opacity: 0.25 },
    ],
  },
  // Pine tree (North Carolina) — layered conifer with detail
  NC: {
    viewBox: '0 0 100 130',
    paths: [
      // Tree layers (bottom to top)
      { d: 'M50 8 L30 40 L38 38 L20 65 L30 62 L10 90 L90 90 L70 62 L80 65 L62 38 L70 40 Z', strokeWidth: 2, opacity: 1 },
      // Internal branch detail lines
      { d: 'M50 8 L42 25 M50 8 L58 25 M50 30 L35 50 M50 30 L65 50 M50 55 L30 75 M50 55 L70 75', strokeWidth: 1, opacity: 0.3 },
      // Trunk
      { d: 'M45 90 L45 120 L55 120 L55 90', strokeWidth: 2, opacity: 0.8 },
      // Trunk bark texture
      { d: 'M48 95 L48 115 M52 98 L52 112', strokeWidth: 0.8, opacity: 0.25 },
      // Ground
      { d: 'M5 120 Q25 116 50 120 Q75 124 95 120', strokeWidth: 1.5, opacity: 0.35 },
    ],
  },
  // Peach (Georgia) — detailed with leaf and stem
  GA: {
    viewBox: '0 0 100 110',
    paths: [
      // Main peach body
      { d: 'M50 95 Q15 85 15 50 Q15 18 50 12 Q85 18 85 50 Q85 85 50 95 Z', strokeWidth: 2.5, opacity: 1 },
      // Center crease
      { d: 'M50 15 Q48 50 50 95', strokeWidth: 1.5, opacity: 0.5 },
      // Subtle highlight curve
      { d: 'M35 30 Q30 50 35 75', strokeWidth: 1, opacity: 0.25 },
      // Stem
      { d: 'M50 12 Q52 4 56 2 L55 8 Q53 10 50 12', strokeWidth: 1.5, opacity: 0.8 },
      // Leaf
      { d: 'M53 8 Q65 2 75 8 Q65 14 53 8 Z', strokeWidth: 1.5, opacity: 0.7 },
      // Leaf vein
      { d: 'M55 8 L70 8', strokeWidth: 0.8, opacity: 0.35 },
    ],
  },
  // Liberty Bell (Pennsylvania) — detailed with crack and yoke
  PA: {
    viewBox: '0 0 100 120',
    paths: [
      // Bell body
      { d: 'M25 25 Q20 25 18 35 L15 75 Q15 100 50 100 Q85 100 85 75 L82 35 Q80 25 75 25', strokeWidth: 2.5, opacity: 1 },
      // Yoke / crown
      { d: 'M30 25 L30 10 L70 10 L70 25', strokeWidth: 2, opacity: 0.8 },
      // Yoke cross beam
      { d: 'M25 10 L75 10', strokeWidth: 2.5, opacity: 0.7 },
      // Crack
      { d: 'M50 55 L48 62 L52 70 L49 78 L51 85 L48 92', strokeWidth: 1.5, opacity: 0.7 },
      // Decorative bands
      { d: 'M22 40 Q50 38 78 40', strokeWidth: 1.5, opacity: 0.4 },
      { d: 'M18 70 Q50 68 82 70', strokeWidth: 1.5, opacity: 0.4 },
      // Clapper hint
      { d: 'M50 75 L50 95', strokeWidth: 1.5, opacity: 0.3 },
      // Lip of bell
      { d: 'M15 95 Q50 92 85 95', strokeWidth: 2, opacity: 0.5 },
    ],
  },
  // Great Lakes outline (Michigan) — Upper & Lower peninsulas
  MI: {
    viewBox: '0 0 140 110',
    paths: [
      // Upper Peninsula
      { d: 'M15 45 Q20 35 30 32 Q45 28 55 30 Q65 32 72 38 Q78 42 80 48 Q75 52 68 54 Q55 58 40 55 Q25 52 15 45 Z', strokeWidth: 2, opacity: 0.8 },
      // Lower Peninsula (mitten)
      { d: 'M65 50 Q70 45 78 42 Q85 40 92 42 Q100 45 105 52 Q110 60 112 70 Q112 82 105 90 Q95 98 85 100 Q75 100 68 95 Q60 88 58 78 Q56 68 58 60 Q60 54 65 50 Z', strokeWidth: 2.5, opacity: 1 },
      // Thumb
      { d: 'M105 52 Q112 48 118 50 Q124 54 122 62 Q118 68 112 70', strokeWidth: 2, opacity: 0.9 },
      // Straits of Mackinac bridge hint
      { d: 'M72 44 Q76 42 80 44', strokeWidth: 1, opacity: 0.4 },
      // Lake detail ripples
      { d: 'M35 38 Q42 36 50 38 M70 60 Q80 58 90 60', strokeWidth: 0.8, opacity: 0.2 },
    ],
  },
  // Wheat stalk (Wisconsin) — detailed with grain heads
  WI: {
    viewBox: '0 0 80 120',
    paths: [
      // Main stem
      { d: 'M40 110 L40 25', strokeWidth: 2.5, opacity: 1 },
      // Grain heads (paired, alternating)
      { d: 'M40 25 Q35 18 30 15 Q28 12 30 10 Q34 12 36 18 L40 25', strokeWidth: 1.5, opacity: 0.8 },
      { d: 'M40 25 Q45 18 50 15 Q52 12 50 10 Q46 12 44 18 L40 25', strokeWidth: 1.5, opacity: 0.8 },
      { d: 'M40 35 Q33 28 27 25 Q24 22 26 20 Q30 22 33 28 L40 35', strokeWidth: 1.5, opacity: 0.7 },
      { d: 'M40 35 Q47 28 53 25 Q56 22 54 20 Q50 22 47 28 L40 35', strokeWidth: 1.5, opacity: 0.7 },
      { d: 'M40 45 Q32 38 25 35 Q22 32 24 30 Q28 32 32 38 L40 45', strokeWidth: 1.5, opacity: 0.6 },
      { d: 'M40 45 Q48 38 55 35 Q58 32 56 30 Q52 32 48 38 L40 45', strokeWidth: 1.5, opacity: 0.6 },
      { d: 'M40 55 Q33 48 27 45 Q24 42 26 40 Q30 42 33 48 L40 55', strokeWidth: 1.5, opacity: 0.5 },
      { d: 'M40 55 Q47 48 53 45 Q56 42 54 40 Q50 42 47 48 L40 55', strokeWidth: 1.5, opacity: 0.5 },
      // Lower leaves
      { d: 'M40 70 Q30 62 20 60 M40 70 Q50 62 60 60', strokeWidth: 1.2, opacity: 0.4 },
      { d: 'M40 85 Q32 78 22 76 M40 85 Q48 78 58 76', strokeWidth: 1.2, opacity: 0.35 },
    ],
  },
  // Desert landscape (Nevada) — buttes, desert floor, sun
  NV: {
    viewBox: '0 0 200 100',
    paths: [
      // Sun/moon circle
      { d: 'M160 20 A 12 12 0 1 1 159.99 20', strokeWidth: 1.5, opacity: 0.3 },
      // Far mesa/butte
      { d: 'M120 80 L125 45 L140 40 L155 45 L160 80', strokeWidth: 1.5, opacity: 0.35 },
      // Main butte
      { d: 'M55 80 L60 35 L70 28 L85 28 L95 35 L100 80', strokeWidth: 2.5, opacity: 1 },
      // Butte horizontal strata lines
      { d: 'M62 45 L93 45 M60 55 L95 55 M58 65 L97 65', strokeWidth: 1, opacity: 0.3 },
      // Small cactus left
      { d: 'M25 80 L25 60 Q25 55 27 55 Q29 55 29 60 L29 80 M25 65 L20 65 L20 60', strokeWidth: 1.5, opacity: 0.5 },
      // Small shrub right
      { d: 'M170 80 Q168 72 172 68 Q178 68 180 72 Q182 68 186 70 Q188 74 185 80', strokeWidth: 1.2, opacity: 0.35 },
      // Desert floor
      { d: 'M0 80 Q50 78 100 80 Q150 82 200 80', strokeWidth: 2, opacity: 0.5 },
      // Desert floor texture dots
      { d: 'M15 82 L16 82 M40 81 L41 81 M70 82 L71 82 M110 81 L111 81 M140 82 L141 82 M175 81 L176 81', strokeWidth: 2, opacity: 0.2 },
    ],
  },
}

export default function StateWatermark({ state }: { state?: string }) {
  if (!state) return null
  const upper = state.toUpperCase()

  // Alaska uses a real Denali photograph as watermark
  if (upper === 'AK') {
    return (
      <div
        className="absolute top-0 right-0 w-[500px] h-[340px] pointer-events-none overflow-hidden"
        style={{
          opacity: 0.12,
          maskImage: 'linear-gradient(to bottom, black 30%, transparent 90%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 30%, transparent 90%)',
        }}
      >
        {/* Photo: Patrick Federi / Unsplash (free license) */}
        <img
          src="/denali-watermark.jpg"
          alt=""
          className="w-full h-full object-cover object-center grayscale brightness-150"
          aria-hidden="true"
        />
      </div>
    )
  }

  const icon = STATE_ICONS[upper]
  if (!icon) return null

  return (
    <div
      className="absolute top-0 right-0 w-[400px] h-[300px] pointer-events-none overflow-hidden"
      style={{
        opacity: 0.08,
        maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
      }}
    >
      <svg
        viewBox={icon.viewBox}
        className="w-full h-full"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon.paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke="currentColor"
            strokeWidth={p.strokeWidth ?? 2}
            opacity={p.opacity ?? 1}
            fill={p.fill ? 'currentColor' : 'none'}
            className="text-white"
          />
        ))}
      </svg>
    </div>
  )
}
