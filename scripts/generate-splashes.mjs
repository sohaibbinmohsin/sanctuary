/**
 * Regenerates iOS apple-touch-startup-image PNGs under public/splashes/.
 *
 * Usage:
 *   node scripts/generate-splashes.mjs
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'public/splashes')
const markPath = path.join(root, 'public/sanctuary-mark.svg')
const mohsinPath = path.join(root, 'public/mohsin-project-logo-white.svg')

function getFontBase64(relPath) {
  const fullPath = path.join(root, 'node_modules/@fontsource', relPath)
  return fs.readFileSync(fullPath).toString('base64')
}

const outfit700 = getFontBase64('outfit/files/outfit-latin-700-normal.woff2')
const dmSans500 = getFontBase64('dm-sans/files/dm-sans-latin-500-normal.woff2')

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

const markData = fs.readFileSync(markPath).toString('base64')
const mohsinData = fs.readFileSync(mohsinPath).toString('base64')

function html(width, height) {
  const minDim = Math.min(width, height)
  const logoSize = Math.round(minDim * 0.28)
  const titleFontSize = Math.round(minDim * 0.082)
  const subFontSize = Math.round(minDim * 0.034)
  const gapLogoToTitle = Math.round(minDim * 0.03)
  const gapTitleToSub = Math.round(minDim * 0.016)
  const footerFontSize = Math.round(minDim * 0.03)
  const birdHeight = Math.round(footerFontSize * 1.55)
  const footerGap = Math.round(footerFontSize * 0.55)
  const bottomPad = Math.round(height * 0.065)

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @font-face {
      font-family: 'Outfit';
      font-weight: 700;
      src: url(data:font/woff2;base64,${outfit700}) format('woff2');
    }
    @font-face {
      font-family: 'DM Sans';
      font-weight: 500;
      src: url(data:font/woff2;base64,${dmSans500}) format('woff2');
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${FOREST};
      color: ${MIST};
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .frame {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding-bottom: ${bottomPad}px;
    }
    .center {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-bottom: ${Math.round(height * 0.015)}px;
    }
    .logo {
      width: ${logoSize}px;
      height: ${logoSize}px;
      display: block;
      margin-bottom: ${gapLogoToTitle}px;
    }
    .name {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 700;
      font-size: ${titleFontSize}px;
      letter-spacing: -0.02em;
      line-height: 1.1;
      color: ${MIST};
      margin-bottom: ${gapTitleToSub}px;
    }
    .sub {
      font-size: ${subFontSize}px;
      font-weight: 500;
      letter-spacing: -0.01em;
      line-height: 1.2;
      color: rgba(212, 229, 208, 0.9);
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: ${footerGap}px;
      font-size: ${footerFontSize}px;
      font-weight: 500;
      letter-spacing: -0.01em;
      color: rgba(212, 229, 208, 0.85);
      line-height: 1.2;
    }
    .footer img {
      height: ${birdHeight}px;
      width: auto;
      display: block;
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="center">
      <img class="logo" src="data:image/svg+xml;base64,${markData}" alt="" />
      <div class="name">Sanctuary</div>
      <div class="sub">Animal welfare network</div>
    </div>
    <div class="footer">
      <span>A free software by The Mohsin Project</span>
      <img src="data:image/svg+xml;base64,${mohsinData}" alt="" />
    </div>
  </div>
</body>
</html>`
}

const chromeBin =
  process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome'

fs.mkdirSync(outDir, { recursive: true })
const tempHtmlPath = path.join(root, 'scripts/.temp-splash.html')

try {
  for (const [w, h] of SIZES) {
    fs.writeFileSync(tempHtmlPath, html(w, h), 'utf8')
    const file = path.join(outDir, `splash-${w}x${h}.png`)
    execSync(
      `"${chromeBin}" --headless=new --no-sandbox --disable-gpu --force-device-scale-factor=1 --hide-scrollbars --screenshot="${file}" --window-size=${w},${h} "file://${tempHtmlPath}"`,
      { stdio: 'pipe' }
    )
    console.log('wrote', path.relative(root, file))
  }
} finally {
  try {
    fs.unlinkSync(tempHtmlPath)
  } catch {}
}
