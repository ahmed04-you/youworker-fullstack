export interface ApiError {
  message: string
  code?: string
  status: number
  details?: Record<string, unknown>
}

// Discriminated union for better type safety
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError }

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  has_next: boolean
  has_previous: boolean
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: {
    id: string
    email: string
    name: string
  }
}

export interface CSRFTokenResponse {
  csrf_token: string
}

export interface User {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly avatar?: string
  readonly initials: string
  readonly created_at?: string
}

export interface UserSettings {
  theme: 'light' | 'dark'
  fontSize: 'small' | 'medium' | 'large'
  language: string
  defaultModelId: string
  messageHistoryLength: number
  autoScroll: boolean
  soundNotifications: boolean
}
