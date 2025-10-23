import fs from "node:fs"
import path from "node:path"

function loadRootEnvFiles() {
  const repoRoot = path.resolve(process.cwd(), "..", "..")
  const candidates = [".env.local", ".env"]

  for (const file of candidates) {
    const envPath = path.join(repoRoot, file)
    if (!fs.existsSync(envPath)) {
      continue
    }

    const content = fs.readFileSync(envPath, "utf-8")
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith("#")) {
        continue
      }

      const separatorIndex = line.indexOf("=")
      if (separatorIndex === -1) {
        continue
      }

      const key = line.slice(0, separatorIndex).trim()
      if (!key || process.env[key] !== undefined) {
        continue
      }

      let value = line.slice(separatorIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  }
}

loadRootEnvFiles()

if (!process.env.NEXT_PUBLIC_API_KEY && process.env.ROOT_API_KEY) {
  // Align the browser API key with the backend root key when only ROOT_API_KEY is provided.
  process.env.NEXT_PUBLIC_API_KEY = process.env.ROOT_API_KEY
}

const exposedEnv = {}
for (const key of Object.keys(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_")) {
    exposedEnv[key] = process.env[key]
  }
}

const CACHE_HEADERS = [
  {
    key: "Cache-Control",
    value: "public, max-age=31536000, immutable",
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: exposedEnv,
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/webp", "image/avif"],
    unoptimized: true,
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendors",
              chunks: "all",
            },
            lucide: {
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              name: "lucide",
              chunks: "all",
            },
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: "radix",
              chunks: "all",
            },
            ui: {
              test: /[\\/]components[\\/]ui[\\/]/,
              name: "ui",
              chunks: "all",
            },
            chat: {
              test: /[\\/]components[\\/]chat[\\/]/,
              name: "chat",
              chunks: "all",
            },
          },
        },
      }
    }
    return config
  },
  async headers() {
    return [
      {
        source: "/_next/static/(.*)",
        headers: CACHE_HEADERS,
      },
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ]
  },
  async redirects() {
    return []
  },
  async rewrites() {
    return []
  },
}

export default nextConfig
