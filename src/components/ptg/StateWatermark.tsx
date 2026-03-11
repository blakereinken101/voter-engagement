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

// Seeded PRNG for deterministic star placement (avoids hydration mismatch)
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

interface Star { x: number; y: number; r: number; opacity: number; color: string }
interface BrightStar extends Star { brightest: boolean }

/**
 * Generates a dense, natural-looking star field.
 * Uses a seeded PRNG so server & client render identically.
 */
function generateStarField(count: number): Star[] {
  const rng = seededRandom(42)
  const stars: Star[] = []
  // Subtle color palette for realistic star colors
  const colors = [
    '#ffffff',   // pure white (most common)
    '#ffffff',
    '#ffffff',
    '#fff8f0',   // warm white
    '#fff8f0',
    '#f0f0ff',   // cool blue-white
    '#f0f0ff',
    '#ffe8d0',   // warm yellow-white (rare)
    '#e0e8ff',   // blue tint (rare)
  ]

  for (let i = 0; i < count; i++) {
    const x = rng() * 1400
    const y = rng() * 380
    // Most stars are tiny — exponential distribution biased small
    const sizeRoll = rng()
    const r = sizeRoll < 0.6 ? 0.3 + rng() * 0.4        // 60% tiny (0.3-0.7)
            : sizeRoll < 0.85 ? 0.6 + rng() * 0.5       // 25% small (0.6-1.1)
            : sizeRoll < 0.95 ? 1.0 + rng() * 0.5        // 10% medium (1.0-1.5)
            : 1.3 + rng() * 0.5                           // 5% larger (1.3-1.8)
    // Dimmer overall, with size-correlated brightness
    const baseOpacity = 0.1 + r * 0.12
    const opacity = Math.min(baseOpacity + rng() * 0.15, 0.55)
    const color = colors[Math.floor(rng() * colors.length)]
    stars.push({ x, y, r, opacity, color })
  }
  return stars
}

/**
 * Hand-placed bright stars with glow — the ones you'd actually notice in a real sky.
 */
function generateBrightStars(): BrightStar[] {
  return [
    // Prominent white stars
    { x: 180, y: 32, r: 2.8, opacity: 0.85, color: '#ffffff', brightest: true },
    { x: 520, y: 18, r: 3.2, opacity: 0.9,  color: '#fff8f0', brightest: true },
    { x: 920, y: 28, r: 2.6, opacity: 0.8,  color: '#ffffff', brightest: true },
    { x: 1250, y: 45, r: 2.5, opacity: 0.75, color: '#f0f0ff', brightest: true },
    // Subtly tinted bright stars
    { x: 350, y: 55, r: 2.4, opacity: 0.7, color: '#d8d0ff', brightest: false },   // lavender
    { x: 680, y: 42, r: 2.6, opacity: 0.75, color: '#d0f0f0', brightest: false },  // pale teal
    { x: 1050, y: 62, r: 2.3, opacity: 0.7, color: '#e8d8ff', brightest: false },  // soft purple
    { x: 100, y: 85, r: 2.2, opacity: 0.65, color: '#ffffff', brightest: false },
    { x: 430, y: 95, r: 2.5, opacity: 0.7,  color: '#fff8f0', brightest: false },
    { x: 780, y: 78, r: 2.3, opacity: 0.65, color: '#d0e8ff', brightest: false },  // ice blue
    { x: 1180, y: 90, r: 2.2, opacity: 0.6,  color: '#ffffff', brightest: false },
    // Mid-sky bright stars
    { x: 260, y: 140, r: 2.4, opacity: 0.65, color: '#fff8f0', brightest: false },
    { x: 600, y: 120, r: 2.8, opacity: 0.75, color: '#ffffff', brightest: true },
    { x: 880, y: 135, r: 2.2, opacity: 0.6,  color: '#d8d0ff', brightest: false },
    { x: 1100, y: 150, r: 2.0, opacity: 0.55, color: '#ffffff', brightest: false },
    // Lower sky — dimmer
    { x: 150, y: 210, r: 2.0, opacity: 0.5, color: '#ffffff', brightest: false },
    { x: 490, y: 195, r: 2.2, opacity: 0.55, color: '#d0f0f0', brightest: false },
    { x: 730, y: 220, r: 2.0, opacity: 0.5, color: '#ffffff', brightest: false },
    { x: 1000, y: 205, r: 1.8, opacity: 0.45, color: '#e8d8ff', brightest: false },
  ]
}

export default function StateWatermark({ state }: { state?: string }) {
  if (!state) return null
  const upper = state.toUpperCase()

  // Alaska uses a real Denali photograph as watermark with constellation stars
  if (upper === 'AK') {
    // Procedural star field — natural distribution with realistic properties
    const stars = generateStarField(420)
    const brightStars = generateBrightStars()

    return (
      <div className="absolute top-0 left-0 right-0 h-[440px] pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
        {/* Constellation star field */}
        <div
          className="absolute top-0 left-0 right-0 h-[420px] pointer-events-none overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to bottom, black 0%, black 50%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 50%, transparent 95%)',
          }}
        >
          <svg className="w-full h-full" viewBox="0 0 1400 420" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Glow filter for bright stars */}
              <filter id="starGlow" x="-300%" y="-300%" width="700%" height="700%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Stronger glow for the brightest stars */}
              <filter id="starGlowBright" x="-400%" y="-400%" width="900%" height="900%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur1" />
                  <feMergeNode in="blur2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Milky way gradient */}
              <radialGradient id="milkyway">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Milky way band — subtle luminous band across the sky */}
            <ellipse cx="700" cy="140" rx="650" ry="80" fill="url(#milkyway)" opacity="0.035" />
            <ellipse cx="680" cy="135" rx="400" ry="45" fill="url(#milkyway)" opacity="0.025" />

            {/* Faint background stars — hundreds of tiny points */}
            {stars.map((s, i) => (
              <circle
                key={`s${i}`}
                cx={s.x}
                cy={s.y}
                r={s.r}
                fill={s.color}
                opacity={s.opacity}
              />
            ))}

            {/* Medium-bright stars with subtle color variation */}
            {[
              [120,45,1.8,0.65,'#fff'],[245,80,1.6,0.55,'#e8e0ff'],[380,28,1.9,0.6,'#fff'],
              [510,68,1.7,0.55,'#ffe8d0'],[640,22,2,0.65,'#fff'],[770,58,1.8,0.55,'#e0f0ff'],
              [890,35,1.7,0.6,'#fff'],[1020,72,1.9,0.55,'#ffe8d0'],[1150,40,1.8,0.6,'#e8e0ff'],
              [1280,25,1.7,0.55,'#fff'],[60,110,1.6,0.5,'#fff'],[200,135,1.8,0.55,'#e0f0ff'],
              [340,105,1.7,0.5,'#fff'],[480,145,1.9,0.55,'#ffe8d0'],[620,115,1.6,0.5,'#fff'],
              [760,140,1.8,0.55,'#e8e0ff'],[900,100,1.7,0.5,'#fff'],[1040,130,1.6,0.55,'#fff'],
              [1180,108,1.8,0.5,'#e0f0ff'],[1320,145,1.7,0.55,'#ffe8d0'],
              [170,195,1.6,0.45,'#fff'],[310,175,1.7,0.5,'#fff'],[450,210,1.6,0.45,'#e0f0ff'],
              [590,185,1.8,0.5,'#fff'],[730,205,1.7,0.45,'#ffe8d0'],[870,180,1.6,0.5,'#fff'],
              [1010,200,1.7,0.45,'#e8e0ff'],[1150,190,1.6,0.5,'#fff'],
            ].map(([cx, cy, r, op, fill], i) => (
              <circle key={`m${i}`} cx={cx as number} cy={cy as number} r={r as number} fill={fill as string} opacity={op as number} />
            ))}

            {/* Bright glowing stars — the ones that really pop */}
            <g filter="url(#starGlow)">
              {brightStars.filter(s => !s.brightest).map((s, i) => (
                <circle key={`b${i}`} cx={s.x} cy={s.y} r={s.r} fill={s.color} opacity={s.opacity} />
              ))}
            </g>

            {/* Brightest stars — extra glow and larger */}
            <g filter="url(#starGlowBright)">
              {brightStars.filter(s => s.brightest).map((s, i) => (
                <circle key={`bb${i}`} cx={s.x} cy={s.y} r={s.r} fill={s.color} opacity={s.opacity} />
              ))}
            </g>

            {/* Constellation lines — barely visible threads connecting bright stars */}
            <g stroke="rgba(180,190,255,0.06)" strokeWidth="0.4" strokeLinecap="round">
              <line x1="350" y1="30" x2="510" y2="68" />
              <line x1="510" y1="68" x2="640" y2="22" />
              <line x1="640" y1="22" x2="770" y2="58" />
              <line x1="770" y1="58" x2="890" y2="35" />
              <line x1="200" y1="135" x2="350" y2="30" />
              <line x1="890" y1="35" x2="1020" y2="72" />
              <line x1="480" y1="145" x2="510" y2="68" />
              <line x1="760" y1="140" x2="770" y2="58" />
            </g>

            {/* Sparse star clusters — tiny groupings that mimic real sky patterns */}
            {[
              [300,55],[302,58],[305,54],[298,52],[304,60],
              [850,42],[853,45],[848,40],[855,38],[851,47],
              [550,125],[553,128],[548,122],[556,126],[551,130],
              [1100,75],[1103,78],[1098,72],[1105,76],[1101,80],
            ].map(([cx, cy], i) => (
              <circle key={`cl${i}`} cx={cx} cy={cy} r={0.6 + Math.random() * 0.4} fill="white" opacity={0.25 + Math.random() * 0.2} />
            ))}
          </svg>
        </div>

        {/* Denali photo — full width with smooth edge fade */}
        <div
          className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none overflow-hidden"
          style={{
            opacity: 0.18,
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 45%, transparent 92%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 45%, transparent 92%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            maskComposite: 'intersect',
            WebkitMaskComposite: 'destination-in' as string,
          }}
        >
          {/* Photo: Patrick Federi / Unsplash (free license) */}
          <img
            src="/denali-watermark.jpg"
            alt=""
            className="w-full h-full object-cover object-[center_40%] grayscale brightness-[1.2] contrast-[1.1]"
            aria-hidden="true"
          />
        </div>
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
