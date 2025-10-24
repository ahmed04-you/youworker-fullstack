const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"])

const getBrowserFallbackApiUrl = () => {
  if (typeof window === "undefined") {
    return "http://localhost:8001"
  }
  const { protocol, hostname } = window.location
  const port = process.env.NEXT_PUBLIC_API_PORT || "8001"
  const portSuffix = port ? `:${port}` : ""
  return `${protocol}//${hostname}${portSuffix}`
}

const resolvePublicApiBaseUrl = () => {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!configured) {
    return getBrowserFallbackApiUrl()
  }

  try {
    const parsed = new URL(configured)
    if (
      typeof window !== "undefined" &&
      LOCAL_HOSTS.has(parsed.hostname) &&
      !LOCAL_HOSTS.has(window.location.hostname)
    ) {
      return getBrowserFallbackApiUrl()
    }
  } catch {
    return configured
  }

  return configured
}

const PUBLIC_API_BASE_URL = resolvePublicApiBaseUrl()

const INTERNAL_API_BASE_URL =
  process.env.NEXT_INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://api:8001"

export const API_BASE_URL = typeof window === "undefined" ? INTERNAL_API_BASE_URL : PUBLIC_API_BASE_URL
