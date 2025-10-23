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

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: exposedEnv,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
