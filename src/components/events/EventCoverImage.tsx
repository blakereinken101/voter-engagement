'use client'

interface Props {
  coverImageUrl: string | null
  emoji: string
  themeColor: string
  title: string
  size?: 'card' | 'hero'
}

export default function EventCoverImage({ coverImageUrl, emoji, themeColor, title, size = 'card' }: Props) {
  const height = size === 'hero' ? 'h-[400px]' : 'h-[200px]'

  if (coverImageUrl) {
    return (
      <div className={`relative ${height} w-full overflow-hidden`}>
        <img
          src={coverImageUrl}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, transparent 40%, ${themeColor}40 70%, ${themeColor}90 100%)`,
          }}
        />
      </div>
    )
  }

  // Gradient fallback with emoji
  return (
    <div
      className={`relative ${height} w-full flex items-center justify-center overflow-hidden`}
      style={{
        background: `linear-gradient(135deg, ${themeColor}30 0%, ${themeColor}60 50%, ${themeColor}90 100%)`,
      }}
    >
      {/* Decorative circles */}
      <div
        className="absolute top-4 right-8 w-32 h-32 rounded-full opacity-20 blur-2xl"
        style={{ backgroundColor: themeColor }}
      />
      <div
        className="absolute bottom-8 left-4 w-24 h-24 rounded-full opacity-15 blur-xl"
        style={{ backgroundColor: themeColor }}
      />
      <span className={size === 'hero' ? 'text-8xl' : 'text-6xl'} role="img" aria-label={title}>
        {emoji}
      </span>
    </div>
  )
}
