'use client'

/**
 * Renders a subtle, faint SVG watermark behind the PTG header area
 * based on the campaign's state. Only shows for targeted states.
 */

const STATE_ICONS: Record<string, { paths: string; viewBox: string }> = {
  // Mountains (Alaska)
  AK: {
    viewBox: '0 0 120 60',
    paths: 'M10 55 L30 15 L45 35 L55 10 L70 40 L80 20 L95 45 L110 55 Z M0 58 L120 58',
  },
  // Cactus (Arizona)
  AZ: {
    viewBox: '0 0 80 100',
    paths: 'M35 95 L35 30 M35 50 L20 50 L20 35 M35 40 L55 40 L55 25 M30 95 L40 95 M35 30 Q35 20 40 20 Q45 20 45 30 L45 35',
  },
  // Pine tree (North Carolina)
  NC: {
    viewBox: '0 0 80 100',
    paths: 'M40 5 L15 40 L25 40 L10 65 L22 65 L5 90 L75 90 L58 65 L70 65 L55 40 L65 40 Z M38 90 L38 100 L42 100 L42 90',
  },
  // Peach (Georgia)
  GA: {
    viewBox: '0 0 80 90',
    paths: 'M40 85 Q10 75 10 45 Q10 15 40 10 Q70 15 70 45 Q70 75 40 85 Z M40 10 Q40 0 50 2 L45 12 M38 10 Q30 5 35 12',
  },
  // Liberty Bell (Pennsylvania)
  PA: {
    viewBox: '0 0 80 100',
    paths: 'M25 15 L55 15 M20 20 Q15 20 15 30 L15 70 Q15 90 40 90 Q65 90 65 70 L65 30 Q65 20 60 20 Z M40 50 Q38 55 38 60 Q38 70 42 70 Q46 70 42 60 Q42 55 40 50 M30 15 L30 5 L50 5 L50 15',
  },
  // Great Lakes outline (Michigan)
  MI: {
    viewBox: '0 0 100 80',
    paths: 'M30 10 Q20 15 15 25 Q10 40 20 50 Q30 60 45 65 Q60 70 70 60 Q80 50 85 35 Q90 20 80 12 Q70 5 55 8 Q40 5 30 10 Z M50 30 Q45 35 50 40 Q55 35 50 30 Z',
  },
  // Wheat stalk (Wisconsin)
  WI: {
    viewBox: '0 0 60 100',
    paths: 'M30 95 L30 30 M30 30 L20 20 M30 30 L40 20 M30 40 L18 30 M30 40 L42 30 M30 50 L16 40 M30 50 L44 40 M30 60 L14 50 M30 60 L46 50 M30 70 L18 60 M30 70 L42 60',
  },
  // Desert landscape (Nevada)
  NV: {
    viewBox: '0 0 120 60',
    paths: 'M0 55 L20 55 Q25 55 30 50 Q35 45 40 45 Q45 45 45 50 L50 55 L70 55 M60 55 L75 30 L90 55 M85 55 L95 35 L105 55 L120 55 M15 40 Q15 35 20 35 Q25 35 25 40',
  },
}

export default function StateWatermark({ state }: { state?: string }) {
  if (!state) return null
  const icon = STATE_ICONS[state.toUpperCase()]
  if (!icon) return null

  return (
    <div className="absolute top-0 right-0 w-[280px] h-[180px] pointer-events-none overflow-hidden opacity-[0.04]">
      <svg
        viewBox={icon.viewBox}
        className="w-full h-full"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon.paths} className="text-white" />
      </svg>
    </div>
  )
}
