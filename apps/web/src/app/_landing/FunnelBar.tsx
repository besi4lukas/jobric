'use client'

import { useEffect, useRef, useState } from 'react'

export function FunnelBar({
  label,
  value,
  width,
}: {
  label: string
  value: number
  width: number
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [fill, setFill] = useState(0)

  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setFill(width)
            io.disconnect()
          }
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [width])

  return (
    <div className="bar-row" ref={rowRef}>
      <span>{label}</span>
      <div className="bar">
        <div style={{ width: `${fill}%` }} />
        <span className="v">{value}</span>
      </div>
      <span />
    </div>
  )
}
