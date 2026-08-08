import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Load KEY=VALUE pairs from .env.local (preferred) or .env into process.env.
 * Does not override variables already set in the environment.
 */
export function loadEnvFiles(cwd = process.cwd()) {
  for (const name of ['.env.local', '.env']) {
    const path = resolve(cwd, name)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
}
