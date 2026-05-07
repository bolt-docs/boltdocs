import { resolve } from 'path'
import fs from 'fs'
import * as TJS from 'typescript-json-schema'

// Configuration
const settings: TJS.PartialArgs = {
  required: true,
  noExtraProps: true,
}

const compilerOptions = {
  strictNullChecks: true,
  skipLibCheck: true,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
}

const program = TJS.getProgramFromFiles(
  [resolve('packages/core/src/node/cli/doctor-config.ts')],
  compilerOptions,
)

const schema = TJS.generateSchema(program, 'DoctorConfig', settings)

if (schema) {
  const outputDir = resolve('docs/public/schemas')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const outputPath = resolve(outputDir, 'doctor-config.schema.json')
  fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2))
  console.log(`✅ JSON Schema generated at: ${outputPath}`)
} else {
  console.error('❌ Failed to generate JSON Schema')
  process.exit(1)
}
