'use client'

import { useState } from 'react'
import { TIMELINE } from '../../_data/timeline'
import type { TimelineTab } from '../../_lib/types'
import { TimelineMonth } from './TimelineMonth'

const TABS: { key: TimelineTab; label: string }[] = [
  { key: 'all', label: 'All events' },
  { key: 'applications', label: 'Applications' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'offers', label: 'Offers' },
]

export function TimelineView() {
  const [tab, setTab] = useState<TimelineTab>('all')

  return (
    <section className="view active">
      <div className="view-actions">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'active' : ''}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="meta">156 events tracked</span>
      </div>

      <div className="tl-container">
        {TIMELINE.map((m) => (
          <TimelineMonth key={m.label} month={m} />
        ))}
      </div>
    </section>
  )
}
