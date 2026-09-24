import { useId } from 'react'

type Point = { day: string; value: number | null }
type Indexed = Point & { index: number }

type Series = {
  id: string
  label: string
  color: string
  points: Point[]
}

type ChartProps = {
  title: string
  note: string
  series: Series[]
}

const WIDTH = 720
const HEIGHT = 240
const PAD = { top: 16, right: 16, bottom: 36, left: 52 }

export function Chart({ title, note, series }: ChartProps) {
  const labelId = useId()
  const present = series.flatMap((item) => item.points.map((point) => point.value)).filter((value): value is number => value !== null)
  if (present.length === 0) {
    return (
      <section className="panel">
        <h2>{title}</h2>
        <p className="muted">This report does not include {note}.</p>
      </section>
    )
  }
  const max = Math.max(...present, 0)
  const days = series[0]?.points.map((point) => point.day) ?? []
  const innerW = WIDTH - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const xAt = (index: number) => PAD.left + (days.length <= 1 ? innerW / 2 : (index / (days.length - 1)) * innerW)
  const yAt = (value: number) => PAD.top + innerH - (max === 0 ? 0 : (value / max) * innerH)

  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="muted">{note}</p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={labelId} className="chart">
        <title id={labelId}>{title}</title>
        <line x1={PAD.left} y1={PAD.top + innerH} x2={WIDTH - PAD.right} y2={PAD.top + innerH} className="axis" />
        <text x={PAD.left - 8} y={PAD.top + 4} textAnchor="end" className="tick">
          {formatTick(max)}
        </text>
        <text x={PAD.left - 8} y={PAD.top + innerH} textAnchor="end" className="tick">
          0
        </text>
        {days.length > 0 && (
          <>
            <text x={xAt(0)} y={HEIGHT - 10} textAnchor="start" className="tick">
              {days[0]}
            </text>
            <text x={xAt(days.length - 1)} y={HEIGHT - 10} textAnchor="end" className="tick">
              {days[days.length - 1]}
            </text>
          </>
        )}
        {series.map((item) =>
          runs(item.points).map((run) => (
            <polyline key={`${item.id}-${run[0]?.index}`} points={polyline(run, xAt, yAt)} fill="none" stroke={item.color} strokeWidth="2" />
          )),
        )}
      </svg>
      <ul className="legend">
        {series.map((item) => (
          <li key={item.id}>
            <span className="swatch" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  )
}

function runs(points: Point[]): Indexed[][] {
  const groups: Indexed[][] = []
  let current: Indexed[] = []
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length > 0) groups.push(current)
      current = []
      return
    }
    current.push({ ...point, index })
  })
  if (current.length > 0) groups.push(current)
  return groups
}

function polyline(points: Indexed[], xAt: (index: number) => number, yAt: (value: number) => number): string {
  return points.map((point) => `${xAt(point.index)},${yAt(point.value ?? 0)}`).join(' ')
}

function formatTick(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}
