#!/usr/bin/env node

// Script for install native binary
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read version from package.json dynamically
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
)
const VERSION = packageJson.version

const REPO = 'boltdocs/boltdocs'
const CACHE_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '.cache',
  '@bdocs',
  'parser',
  VERSION,
)

const PLATFORM_MAP = {
  'linux-x64': 'parser-linux-x64',
  'linux-arm64': 'parser-linux-arm64',
  'darwin-x64': 'parser-darwin-x64',
  'darwin-arm64': 'parser-darwin-arm64',
  'win32-x64': 'parser-win-x64.exe',
}

function getPlatformKey() {
  return `${process.platform}-${process.arch}`
}

function getBinaryNameForPlatform() {
  const key = getPlatformKey()
  return PLATFORM_MAP[key] || null
}

function getCachePath() {
  const binaryName = getBinaryNameForPlatform()
  if (!binaryName) return null
  return path.join(CACHE_DIR, binaryName)
}

function getDownloadUrl() {
  const binaryName = getBinaryNameForPlatform()
  if (!binaryName) return null
  return `https://github.com/${REPO}/releases/download/@bdocs/parser@${VERSION}/${binaryName}`
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const request = (downloadUrl) => {
      https
        .get(downloadUrl, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // Follow redirect
            request(response.headers.location)
            return
          }

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${downloadUrl}`))
            return
          }

          const file = fs.createWriteStream(dest)
          response.pipe(file)
          file.on('finish', () => {
            file.close()
            fs.chmodSync(dest, 0o755)
            resolve()
          })
          file.on('error', (err) => {
            fs.unlinkSync(dest)
            reject(err)
          })
        })
        .on('error', reject)
    }

    request(url)
  })
}

function verifyBinary(binaryPath) {
  try {
    execSync(`"${binaryPath}" --version`, {
      encoding: 'utf8',
      timeout: 10000,
      stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

async function install() {
  const platformKey = getPlatformKey()
  const binaryName = getPlatformKey() ? PLATFORM_MAP[platformKey] : null

  if (!binaryName) {
    console.log(
      `[bdocs-parser] Unsupported platform: ${platformKey}. Using WASM fallback.`,
    )
    return
  }

  const cachePath = getCachePath()
  const downloadUrl = getDownloadUrl()

  // 1. Check cache
  if (cachePath && fs.existsSync(cachePath)) {
    if (verifyBinary(cachePath)) {
      return
    }
    fs.unlinkSync(cachePath)
  }

  // 2. Download from GitHub Release
  if (!downloadUrl) {
    console.log(
      `[bdocs-parser] Cannot determine download URL for ${platformKey}. Using WASM fallback.`,
    )
    return
  }

  try {
    await downloadFile(downloadUrl, cachePath)
    if (verifyBinary(cachePath)) {
      return
    }
    console.log(
      `[bdocs-parser] Downloaded binary verification failed. Using WASM fallback.`,
    )
  } catch (error) {
    console.log(
      `[bdocs-parser] Failed to download native binary: ${error.message}. Using WASM fallback.`,
    )
  }
}

install()
