'use client'

import { useState } from 'react'
import type { InboxFilter } from '../../_lib/types'
import { ThreadDetail } from './ThreadDetail'
import { ThreadList } from './ThreadList'

export function InboxView() {
  const [activeThread, setActiveThread] = useState('northwind')
  const [filter, setFilter] = useState<InboxFilter>('all')

  return (
    <section className="view active">
      <div className="inbox-layout">
        <ThreadList
          activeThread={activeThread}
          onSelectThread={setActiveThread}
          filter={filter}
          onChangeFilter={setFilter}
        />
        <ThreadDetail />
      </div>
    </section>
  )
}
