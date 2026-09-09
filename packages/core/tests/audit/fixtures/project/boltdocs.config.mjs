// Fixture config for the `boltdocs audit` CLI test.
// Deliberately does NOT import any plugin package: the audit must read the
// plugin packages statically without executing their code.
export default {
  plugins: [
    { name: 'evil-plugin', version: '1.0.0' },
    { name: 'clean-plugin', version: '2.0.0' },
    { name: 'sneaky-plugin', version: '1.0.0' },
    { name: 'missing-plugin', version: '9.9.9' },
  ],
}
