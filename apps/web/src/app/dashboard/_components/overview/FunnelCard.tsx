'use client'

import { useEffect, useState } from 'react'
import { FUNNEL } from '../../_data/overview'

export function FunnelCard() {
  const [widths, setWidths] = useState<number[]>(() => FUNNEL.map(() => 0))

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(
      setTimeout(() => {
        FUNNEL.forEach((f, i) => {
          timers.push(
            setTimeout(() => {
              setWidths((prev) => {
                const next = [...prev]
                next[i] = f.w
                return next
              })
            }, i * 120),
          )
        })
      }, 100),
    )
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="card funnel">
      <div className="card-head">
        <h3>Your funnel</h3>
        <span className="meta">Last 60 days</span>
      </div>
      {FUNNEL.map((f, i) => (
        <div key={f.label} className="bar-row">
          <span>{f.label}</span>
          <div className="bar">
            <div style={{ width: `${widths[i] ?? 0}%` }} />
          </div>
          <span className="num">{f.n}</span>
        </div>
      ))}
    </div>
  )
}
