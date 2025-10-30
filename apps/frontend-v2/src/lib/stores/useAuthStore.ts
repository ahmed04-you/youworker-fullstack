import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { LOCAL_STORAGE_KEYS } from '@/src/lib/constants/app'

interface User {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly avatar?: string
  readonly initials: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: User) => void
  logout: () => void
  updateUser: (updates: Partial<Omit<User, 'id' | 'initials'>>) => void
  setLoading: (loading: boolean) => void
}

function generateInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
      updateUser: (updates) => set((state) => ({
        user: state.user ? {
          ...state.user,
          ...updates,
          initials: updates.name ? generateInitials(updates.name) : state.user.initials
        } : null
      })),
      setLoading: (loading) => set({ isLoading: loading })
    }),
    {
      name: LOCAL_STORAGE_KEYS.auth,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated })
    }
  )
)
