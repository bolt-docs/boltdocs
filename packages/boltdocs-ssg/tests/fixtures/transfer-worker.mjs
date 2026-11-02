import Piscina from 'piscina'

export default function transferWorker() {
  const html = '<main>Transferred SSR HTML — <strong>ok</strong></main>'.repeat(
    128,
  )
  const buffer = new TextEncoder().encode(html).buffer

  const result = {
    path: '/transfer-test',
    _appHTMLBuffer: buffer,
    metaAttributes: [],
    bodyAttributes: '',
    htmlAttributes: '',
    routerContext: null,
  }

  return Piscina.move({
    get [Piscina.transferableSymbol]() {
      return [buffer]
    },
    get [Piscina.valueSymbol]() {
      return result
    },
  })
}
