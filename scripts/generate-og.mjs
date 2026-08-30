import { writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Read fonts to base64
function getFontBase64(relPath) {
  const fullPath = join(root, 'node_modules/@fontsource', relPath)
  return readFileSync(fullPath).toString('base64')
}

const outfit700 = getFontBase64('outfit/files/outfit-latin-700-normal.woff2')
const outfit600 = getFontBase64('outfit/files/outfit-latin-600-normal.woff2')
const dmSans400 = getFontBase64('dm-sans/files/dm-sans-latin-400-normal.woff2')
const dmSans500 = getFontBase64('dm-sans/files/dm-sans-latin-500-normal.woff2')
const dmSans600 = getFontBase64('dm-sans/files/dm-sans-latin-600-normal.woff2')
const dmMono400 = getFontBase64('dm-mono/files/dm-mono-latin-400-normal.woff2')

// Read SVG logos
const sanctuaryLogoSvg = readFileSync(join(root, 'public/sanctuary-logo.svg'), 'utf8')
const mohsinLogoSvg = readFileSync(join(root, 'public/mohsin-project-logo.svg'), 'utf8')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
@font-face {
  font-family: 'Outfit';
  font-weight: 700;
  src: url(data:font/woff2;base64,${outfit700}) format('woff2');
}
@font-face {
  font-family: 'Outfit';
  font-weight: 600;
  src: url(data:font/woff2;base64,${outfit600}) format('woff2');
}
@font-face {
  font-family: 'DM Sans';
  font-weight: 400;
  src: url(data:font/woff2;base64,${dmSans400}) format('woff2');
}
@font-face {
  font-family: 'DM Sans';
  font-weight: 500;
  src: url(data:font/woff2;base64,${dmSans500}) format('woff2');
}
@font-face {
  font-family: 'DM Sans';
  font-weight: 600;
  src: url(data:font/woff2;base64,${dmSans600}) format('woff2');
}
@font-face {
  font-family: 'DM Mono';
  font-weight: 400;
  src: url(data:font/woff2;base64,${dmMono400}) format('woff2');
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  width: 1200px;
  height: 630px;
  background: #f7faf8;
  font-family: 'DM Sans', sans-serif;
  color: #1a2e22;
  overflow: hidden;
  display: flex;
}

.og {
  width: 1200px;
  height: 630px;
  background: radial-gradient(circle at 10% 20%, #eef5f0 0%, #f7faf8 45%, #e8f0eb 100%);
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  align-items: center;
  padding: 0 5.2rem;
  gap: 3.5rem;
  position: relative;
}

.og-copy {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  justify-content: center;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 1.1rem;
}

.brand-logo {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-logo svg {
  width: 100%;
  height: 100%;
  display: block;
}

.brand-title {
  margin: 0;
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 3.4rem;
  letter-spacing: -0.03em;
  line-height: 1;
  color: #1b4332;
}

.tagline {
  margin: 0.15rem 0 0;
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.4;
  color: #4a5c50;
  max-width: 20ch;
}

.credit {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.85rem;
  font-size: 0.98rem;
  font-weight: 500;
  color: #4a5c50;
}

.credit svg {
  height: 16px;
  width: auto;
  display: inline-block;
}

.desk {
  background: #ffffff;
  border: 1px solid #c5d0c8;
  border-radius: 18px;
  padding: 1.85rem 1.95rem;
  box-shadow: 0 16px 40px rgba(26, 46, 34, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
}

.desk-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.desk-head h3 {
  margin: 0;
  font-family: 'Outfit', sans-serif;
  font-size: 1.65rem;
  font-weight: 700;
  color: #1a2e22;
  letter-spacing: -0.02em;
}

.desk-head span {
  font-size: 1.05rem;
  font-weight: 500;
  color: #4a5c50;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.chip {
  font-size: 0.92rem;
  font-weight: 600;
  padding: 0.42rem 0.85rem;
  border-radius: 999px;
}

.chip-ok {
  background: #e3ede6;
  color: #2f5d3a;
}

.chip-warn {
  background: #fef3e7;
  color: #b45309;
}

.chip-care {
  background: #e7f1f0;
  color: #2a5c58;
  border: 1px solid #c9dcda;
}

.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.card {
  border: 1px solid #c5d0c8;
  border-radius: 12px;
  background: #f7faf8;
  padding: 0.9rem 1rem;
}

.card-type {
  font-size: 0.85rem;
  color: #4a5c50;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.card-name {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 1.28rem;
  color: #1a2e22;
  line-height: 1.15;
}

.card-id {
  margin-top: 0.4rem;
  font-family: 'DM Mono', monospace;
  font-size: 0.85rem;
  color: #2f5d3a;
  letter-spacing: 0.02em;
}
</style>
</head>
<body>
<div class="og">
  <div class="og-copy">
    <div class="brand-lockup">
      <div class="brand-logo">
        ${sanctuaryLogoSvg}
      </div>
      <h1 class="brand-title">Sanctuary</h1>
    </div>
    <p class="tagline">Phone-first shelter software that works offline.</p>
    <div class="credit">
      <span>Free software by The Mohsin Project</span>
      ${mohsinLogoSvg}
    </div>
  </div>

  <div class="desk">
    <div class="desk-head">
      <h3>Animals</h3>
      <span>47 in care</span>
    </div>
    <div class="chips">
      <span class="chip chip-ok">In sanctuary</span>
      <span class="chip chip-warn">Quarantine</span>
      <span class="chip chip-care">Treatment</span>
    </div>
    <div class="cards">
      <div class="card">
        <div class="card-type">Dog</div>
        <div class="card-name">Rani</div>
        <div class="card-id">TSC-0142</div>
      </div>
      <div class="card">
        <div class="card-type">Cat</div>
        <div class="card-name">Milo</div>
        <div class="card-id">TSC-0187</div>
      </div>
      <div class="card">
        <div class="card-type">Horse</div>
        <div class="card-name">Noor</div>
        <div class="card-id">TSC-0201</div>
      </div>
      <div class="card">
        <div class="card-type">Donkey</div>
        <div class="card-name">Chotu</div>
        <div class="card-id">TSC-0214</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`

const tempHtmlPath = join(root, 'scripts/.temp-og.html')
const tempPngPath = join(root, 'scripts/.temp-og.png')
const targetJpgPath = join(root, 'public/og-image.jpg')

writeFileSync(tempHtmlPath, html, 'utf8')

const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

console.log('Generating OG image via Chrome screenshot...')
execSync(
  `"${chromeBin}" --headless=new --disable-gpu --force-device-scale-factor=1 --screenshot="${tempPngPath}" --window-size=1200,630 "file://${tempHtmlPath}"`,
  { stdio: 'inherit' }
)

console.log('Converting to JPEG...')
execSync(
  `sips -s format jpeg -s formatOptions 92 "${tempPngPath}" --out "${targetJpgPath}"`,
  { stdio: 'inherit' }
)

// Cleanup
try {
  unlinkSync(tempHtmlPath)
  unlinkSync(tempPngPath)
} catch {}

console.log(`Successfully updated ${targetJpgPath}!`)
