/**
 * Validation utility functions for the YouWorker frontend
 */

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 * Requirements: at least 8 characters, 1 uppercase, 1 lowercase, 1 number
 */
export function isValidPassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate file type
 */
export function isValidFileType(
  file: File,
  allowedTypes: string[]
): boolean {
  return allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      const category = type.split('/')[0]
      return file.type.startsWith(`${category}/`)
    }
    return file.type === type
  })
}

/**
 * Validate file size
 */
export function isValidFileSize(
  file: File,
  maxSizeInMB: number
): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024
  return file.size <= maxSizeInBytes
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  const element = document.createElement('div')
  element.textContent = input
  return element.innerHTML
}

/**
 * Validate chat message content
 */
export function validateMessage(content: string): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' }
  }

  if (content.length > 4000) {
    return { valid: false, error: 'Message too long (max 4000 characters)' }
  }

  // Check for potential XSS patterns
  if (/<script|javascript:|onerror=/i.test(content)) {
    return { valid: false, error: 'Invalid content detected' }
  }

  return { valid: true }
}
