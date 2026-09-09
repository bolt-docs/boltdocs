import { chromium } from 'playwright'

const url = process.env.URL || 'http://localhost:5173/docs'
const out = process.env.OUT || '/tmp/shot.png'
const w = Number(process.env.W || 1440)
const h = Number(process.env.H || 900)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: w, height: h } })
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: out, fullPage: false })
await browser.close()
console.log('saved', out)
