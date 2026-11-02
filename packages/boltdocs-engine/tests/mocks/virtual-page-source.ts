export default async function fetchPageSource(): Promise<
  Record<string, string>
> {
  return {
    '/docs/guide': '# Guide\n\nMock raw markdown for tests.',
  }
}
