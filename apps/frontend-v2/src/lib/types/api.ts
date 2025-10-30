export interface ApiError {
  message: string
  code?: string
  status: number
  details?: any
}

export interface ApiResponse<T> {
  data?: T
  error?: ApiError
  success: boolean
}

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
  id: string
  email: string
  name: string
  avatar?: string
  created_at: string
}
