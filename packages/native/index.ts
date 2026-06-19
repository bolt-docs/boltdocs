import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFilePromise = promisify(execFile);

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export interface ParsedDoc {
  rawMatter: string;
  headings: Heading[];
  plainText: string;
  description: string;
}

async function runWasmParser(docsDir: string, wasmPath: string): Promise<Record<string, ParsedDoc>> {
  const { WASI } = await import('node:wasi');
  
  const tempDir = path.resolve(docsDir, '.boltdocs/cache');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempFile = path.resolve(tempDir, `parser-output-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.json`);
  const fd = fs.openSync(tempFile, 'w+');

  try {
    const wasi = new WASI({
      version: 'preview1',
      args: ['bdocs-parser.wasm', '--dir', '.'],
      preopens: {
        '.': docsDir
      },
      stdout: fd
    });

    const wasmBuffer = fs.readFileSync(wasmPath);
    const { instance } = await WebAssembly.instantiate(wasmBuffer, {
      wasi_snapshot_preview1: wasi.wasiImport
    });

    wasi.start(instance);
    fs.closeSync(fd);

    const stdout = fs.readFileSync(tempFile, 'utf8');
    const parsed = JSON.parse(stdout);
    const normalized: Record<string, ParsedDoc> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const absoluteKey = path.resolve(docsDir, key).replace(/\\/g, '/');
      normalized[absoluteKey] = value as ParsedDoc;
    }
    return normalized;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {}
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {}
  }
}

export async function runParser(docsDir: string): Promise<Record<string, ParsedDoc>> {
  const binaryName = process.platform === 'win32' ? 'bdocs-parser.exe' : 'bdocs-parser';
  
  const possiblePaths = [
    path.resolve(__dirname, 'zig-out/bin', binaryName),
    path.resolve(__dirname, 'bin', binaryName),
    path.resolve(__dirname, '../zig-out/bin', binaryName),
    path.resolve(__dirname, '../bin', binaryName),
    // Also support dist builds where wrapper is bundled in dist/index.js
    path.resolve(__dirname, '../../zig-out/bin', binaryName),
    path.resolve(__dirname, '../../bin', binaryName)
  ];

  let binaryPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      binaryPath = p;
      break;
    }
  }

  if (binaryPath && process.env.FORCE_WASM !== 'true') {
    try {
      const { stdout } = await execFilePromise(binaryPath, ['--dir', docsDir], {
        maxBuffer: 50 * 1024 * 1024 // 50MB
      });
      const parsed = JSON.parse(stdout);
      const normalized: Record<string, ParsedDoc> = {};
      for (const [key, value] of Object.entries(parsed)) {
        const absoluteKey = path.resolve(docsDir, key).replace(/\\/g, '/');
        normalized[absoluteKey] = value as ParsedDoc;
      }
      return normalized;
    } catch (e) {
      // Fallback to WASM if native execution fails
    }
  }

  // Fallback to WASM
  const wasmName = 'bdocs-parser.wasm';
  const possibleWasmPaths = [
    path.resolve(__dirname, 'zig-out/bin', wasmName),
    path.resolve(__dirname, 'bin', wasmName),
    path.resolve(__dirname, '../zig-out/bin', wasmName),
    path.resolve(__dirname, '../bin', wasmName),
    path.resolve(__dirname, '../../zig-out/bin', wasmName),
    path.resolve(__dirname, '../../bin', wasmName)
  ];

  let wasmPath = '';
  for (const p of possibleWasmPaths) {
    if (fs.existsSync(p)) {
      wasmPath = p;
      break;
    }
  }

  if (wasmPath) {
    return await runWasmParser(docsDir, wasmPath);
  }

  throw new Error(`[boltdocs-native] Neither native parser binary nor WASM module was found.`);
}
