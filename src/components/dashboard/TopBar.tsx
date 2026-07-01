'use client'

import { User } from 'lucide-react'
import type { Profile } from '@/types'

export type TopBarProps = {
  profile?: Profile
}

export function TopBar({ profile }: TopBarProps) {
  return (
    <header className="fixed right-0 top-0 left-0 z-20 md:left-64 border-b border-border bg-card">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex-1" />
        
        <div className="flex items-center gap-4">
          {profile && (
            <div className="text-right">
              <p className="text-sm font-medium">{profile.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground">{profile.role}</p>
            </div>
          )}
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
        </div>
      </div>
    </header>
  )
}
