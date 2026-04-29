'use client'

import { useState } from 'react'
import { GentleReminderCard } from './GentleReminderCard'
import { QuietHoursCard } from './QuietHoursCard'
import { ReminderList } from './ReminderList'
import { WeeklyDigestCard } from './WeeklyDigestCard'

export function RemindersView({ userEmail }: { userEmail: string }) {
  const [digestOn, setDigestOn] = useState(true)
  const [quietOn, setQuietOn] = useState(true)

  return (
    <section className="view active">
      <div className="reminders-grid">
        <ReminderList />
        <div className="rem-right">
          <WeeklyDigestCard
            userEmail={userEmail}
            on={digestOn}
            onToggle={() => setDigestOn((v) => !v)}
          />
          <QuietHoursCard on={quietOn} onToggle={() => setQuietOn((v) => !v)} />
          <GentleReminderCard />
        </div>
      </div>
    </section>
  )
}
