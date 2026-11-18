#!/usr/bin/env node

// Downloads the prebuilt native parser binary and the N-API shared library for
// the current platform. Both land in the package-local `.cache` directory,
// which is the same location the runtime looks in. If a download fails, the
// runtime transparently falls back to the embedded WASM parser.

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
)
const VERSION = packageJson.version

const REPO = 'boltdocs/boltdocs'
const CACHE_DIR = path.join(__dirname, '.cache')

// Platform -> release asset names. The N-API library names match the artifacts
// published by .github/workflows/build-parser.yml.
const PLATFORM_MAP = {
  'linux-x64': {
    binary: 'parser-linux-x64',
    library: 'libbdocs_parser_napi.so',
  },
  'linux-arm64': {
    binary: 'parser-linux-arm64',
    library: 'libbdocs_parser_napi.so',
  },
  'darwin-x64': {
    binary: 'parser-darwin-x64',
    library: 'libbdocs_parser_napi.dylib',
  },
  'darwin-arm64': {
    binary: 'parser-darwin-arm64',
    library: 'libbdocs_parser_napi.dylib',
  },
  'win32-x64': {
    binary: 'parser-win-x64.exe',
    library: 'bdocs_parser_napi.dll',
  },
}

function getAssets() {
  return PLATFORM_MAP[`${process.platform}-${process.arch}`] ?? null
}

function getDownloadUrl(asset) {
  return `https://github.com/${REPO}/releases/download/@bdocs/parser@${VERSION}/${asset}`
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true })

    const request = (downloadUrl) => {
      https
        .get(downloadUrl, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
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

async function installAsset(asset, { verify = false } = {}) {
  const dest = path.join(CACHE_DIR, asset)
  if (fs.existsSync(dest)) {
    if (!verify || verifyBinary(dest)) return true
    fs.unlinkSync(dest)
  }
  try {
    await downloadFile(getDownloadUrl(asset), dest)
    if (verify && !verifyBinary(dest)) {
      fs.unlinkSync(dest)
      return false
    }
    return true
  } catch {
    return false
  }
}

async function install() {
  const assets = getAssets()
  if (!assets) {
    console.log(
      `[bdocs-parser] Unsupported platform ${process.platform}-${process.arch}. Using WASM fallback.`,
    )
    return
  }

  if (await installAsset(assets.binary, { verify: true })) {
    console.log(`[bdocs-parser] Installed native binary: ${assets.binary}`)
  } else {
    console.log(
      `[bdocs-parser] Native binary unavailable. Using WASM fallback.`,
    )
  }

  // The N-API library is the fastest backend. Install it alongside the CLI
  // binary so the runtime can pick it up with no manual setup.
  if (await installAsset(assets.library)) {
    console.log(`[bdocs-parser] Installed N-API library: ${assets.library}`)
  } else {
    console.log(
      `[bdocs-parser] N-API library unavailable. Native/WASM fallback will be used.`,
    )
  }
}

install()
