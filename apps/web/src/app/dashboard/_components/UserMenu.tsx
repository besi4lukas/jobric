'use client'

import { useEffect, useRef, useState } from 'react'
import { useClerk } from '@clerk/nextjs'

type UserMenuProps = {
  userName: string
  userEmail: string
  userInitial: string
}

export function UserMenu({ userName, userEmail, userInitial }: UserMenuProps) {
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const signOutRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        // Single menu item today, but keep arrow handling generic so adding
        // items later doesn't require rewiring this.
        event.preventDefault()
        signOutRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      signOutRef.current?.focus()
    }
  }, [open])

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut({ redirectUrl: '/' })
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="side-footer user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar">{userInitial}</span>
        <span className="who">
          {userName}
          <small>{userEmail}</small>
        </span>
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-header">{userEmail}</div>
          <button
            type="button"
            ref={signOutRef}
            role="menuitem"
            className="user-menu-item"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
