/**
 * Regenerates iOS apple-touch-startup-image PNGs under public/splashes/.
 *
 * Requires Playwright once:
 *   npm i -D playwright && npx playwright install chromium
 * Usage:
 *   node scripts/generate-splashes.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'public/splashes')
const favicon = path.join(root, 'public/favicon.svg')
const mohsin = path.join(root, 'public/mohsin-project-logo.svg')

const SIZES = [
  [750, 1334],
  [828, 1792],
  [1125, 2436],
  [1170, 2532],
  [1179, 2556],
  [1242, 2688],
  [1290, 2796],
  [1668, 2388],
  [2048, 2732],
]

const FOREST = '#2F5D3A'
const MIST = '#E8EEE9'

function html(width, height) {
  const logo = Math.round(Math.min(width, height) * 0.26)
  const title = Math.round(Math.min(width, height) * 0.09)
  const credit = Math.round(Math.min(width, height) * 0.032)
  const mark = Math.round(credit * 1.65)
  const bottomPad = Math.round(height * 0.07)
  const gap = Math.round(Math.min(width, height) * 0.04)
  const platePad = Math.round(logo * 0.14)

  const favData = fs.readFileSync(favicon).toString('base64')
  const mohsinData = fs.readFileSync(mohsin).toString('base64')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600&family=Outfit:wght@700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${FOREST};
      color: ${MIST};
      font-family: "DM Sans", "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .frame {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .center {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: ${gap}px;
      padding: 0 ${Math.round(width * 0.08)}px;
    }
    .logo-plate {
      width: ${logo + platePad * 2}px;
      height: ${logo + platePad * 2}px;
      border-radius: ${Math.round((logo + platePad * 2) * 0.22)}px;
      background: ${MIST};
      display: grid;
      place-items: center;
    }
    .logo {
      width: ${logo}px;
      height: ${logo}px;
      border-radius: ${Math.round(logo * 0.18)}px;
      display: block;
    }
    .name {
      font-family: "Outfit", "Segoe UI", sans-serif;
      font-weight: 700;
      font-size: ${title}px;
      letter-spacing: -0.03em;
      line-height: 1;
      color: ${MIST};
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: ${Math.round(credit * 0.55)}px;
      padding-bottom: ${bottomPad}px;
      font-size: ${credit}px;
      font-weight: 500;
      color: rgba(232, 238, 233, 0.78);
      line-height: 1.2;
    }
    .footer img {
      height: ${mark}px;
      width: auto;
      display: block;
      filter: brightness(0) invert(1);
      opacity: 0.85;
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="center">
      <div class="logo-plate">
        <img class="logo" src="data:image/svg+xml;base64,${favData}" alt="" />
      </div>
      <div class="name">Sanctuary</div>
    </div>
    <div class="footer">
      <span>Nonprofit software by The Mohsin Project</span>
      <img src="data:image/svg+xml;base64,${mohsinData}" alt="" />
    </div>
  </div>
</body>
</html>`
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    for (const [w, h] of SIZES) {
      const page = await browser.newPage({
        viewport: { width: w, height: h },
        deviceScaleFactor: 1,
      })
      await page.setContent(html(w, h), { waitUntil: 'networkidle' })
      await page.waitForTimeout(200)
      const file = path.join(outDir, `splash-${w}x${h}.png`)
      await page.screenshot({ path: file, type: 'png' })
      await page.close()
      console.log('wrote', path.relative(root, file))
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
