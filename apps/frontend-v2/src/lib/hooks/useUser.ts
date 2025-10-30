'use client'

import { useState, useEffect } from 'react'
import { User } from '@/src/lib/types'
import { errorTracker } from '@/src/lib/utils'

const DEFAULT_USER: User = {
  id: 'demo-user',
  name: 'User Name',
  email: 'user@email.com',
  initials: 'UN'
}

function getUserFromStorage(): User {
  if (typeof window === 'undefined') return DEFAULT_USER

  try {
    const stored = localStorage.getItem('user')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    errorTracker.captureError(error as Error, {
      component: 'useUser',
      action: 'getUserFromStorage'
    })
  }

  return DEFAULT_USER
}

function saveUserToStorage(user: User) {
  try {
    localStorage.setItem('user', JSON.stringify(user))
  } catch (error) {
    errorTracker.captureError(error as Error, {
      component: 'useUser',
      action: 'saveUserToStorage'
    })
  }
}

function generateInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function useUser() {
  const [user, setUser] = useState<User>(DEFAULT_USER)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadedUser = getUserFromStorage()
    setUser(loadedUser)
    setLoading(false)
  }, [])

  const updateUser = (updates: Partial<Omit<User, 'id' | 'initials'>>) => {
    const updatedUser: User = {
      ...user,
      ...updates,
      initials: updates.name ? generateInitials(updates.name) : user.initials
    }
    setUser(updatedUser)
    saveUserToStorage(updatedUser)
  }

  const logout = () => {
    localStorage.removeItem('user')
    setUser(DEFAULT_USER)
    // Additional logout logic would go here
  }

  return {
    user,
    loading,
    updateUser,
    logout
  }
}
