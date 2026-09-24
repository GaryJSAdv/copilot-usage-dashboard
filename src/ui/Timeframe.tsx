import type { DateRange, TimeframePreset } from '../domain/timeframe'

const PRESETS: { id: TimeframePreset; label: string }[] = [
  { id: 'all', label: 'All loaded' },
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
]

type TimeframeControlProps = {
  preset: TimeframePreset
  from: string
  to: string
  active: DateRange | null
  onPreset: (preset: TimeframePreset) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
}

export function TimeframeControl(props: TimeframeControlProps) {
  return (
    <section className="panel timeframe">
      <div className="timeframe-head">
        <h2>Timeframe</h2>
        <p className="muted">UTC calendar days, matching the report day field.</p>
      </div>
      <div className="segmented" role="tablist" aria-label="Timeframe">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={props.preset === item.id}
            className={props.preset === item.id ? 'segment selected' : 'segment'}
            onClick={() => props.onPreset(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {props.preset === 'custom' && (
        <div className="range">
          <label>
            From
            <input type="date" value={props.from} onChange={(event) => props.onFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={props.to} onChange={(event) => props.onTo(event.target.value)} />
          </label>
        </div>
      )}
      {props.active && (
        <p className="muted">
          Showing {props.active.from} to {props.active.to} UTC.
        </p>
      )}
      <p className="muted">
        A single day uses the 1-day report day parameter. The 28-day report has no start or end parameter, so other
        ranges are filtered here. Missing days in a range of 31 or fewer are requested one day at a time.
      </p>
    </section>
  )
}
