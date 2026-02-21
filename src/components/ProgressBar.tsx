interface Props {
  current: number
  total: number
}

export default function ProgressBar({ current, total }: Props) {
  const percent = Math.round((current / total) * 100)

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-white/20 rounded-full h-2">
        <div
          className="bg-rally-yellow h-2 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-white/60 text-xs font-mono whitespace-nowrap">
        {current}/{total}
      </span>
    </div>
  )
}
