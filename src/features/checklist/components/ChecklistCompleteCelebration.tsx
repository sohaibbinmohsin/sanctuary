import { useEffect, type CSSProperties } from 'react'
import { HandsClapping } from '@phosphor-icons/react'

type ChecklistCompleteCelebrationProps = {
  active: boolean
  onDone?: () => void
  durationMs?: number
}

const SPARKS = [
  { x: '-3.2rem', y: '-2.4rem', delay: '0ms', hue: 'forest' },
  { x: '3.4rem', y: '-2.1rem', delay: '40ms', hue: 'amber' },
  { x: '-2.8rem', y: '2.6rem', delay: '80ms', hue: 'amber' },
  { x: '3rem', y: '2.3rem', delay: '120ms', hue: 'forest' },
  { x: '0.2rem', y: '-3.4rem', delay: '60ms', hue: 'forest' },
  { x: '-0.4rem', y: '3.5rem', delay: '100ms', hue: 'amber' },
] as const

/** Full-checklist celebration: clapping hands + short praise. */
export function ChecklistCompleteCelebration({
  active,
  onDone,
  durationMs = 3400,
}: ChecklistCompleteCelebrationProps) {
  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => onDone?.(), durationMs)
    return () => window.clearTimeout(t)
  }, [active, durationMs, onDone])

  if (!active) return null

  return (
    <div className="checklist-celebration" role="status" aria-live="polite">
      <div className="checklist-celebration__card">
        <div className="checklist-celebration__stage" aria-hidden>
          {SPARKS.map((spark, i) => (
            <span
              key={i}
              className={`checklist-celebration__spark checklist-celebration__spark--${spark.hue}`}
              style={
                {
                  '--spark-x': spark.x,
                  '--spark-y': spark.y,
                  '--spark-delay': spark.delay,
                } as CSSProperties
              }
            />
          ))}
          <HandsClapping
            className="checklist-celebration__clap"
            size={64}
            weight="fill"
          />
        </div>
        <p className="checklist-celebration__title">All checked!</p>
        <p className="checklist-celebration__body">
          Wonderful humans finished today’s care. The animals thank you.
        </p>
      </div>
    </div>
  )
}
