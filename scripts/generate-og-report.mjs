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
const mohsinLogoSvg = readFileSync(join(root, 'public/mohsin-project-logo-white.svg'), 'utf8')

const sirenIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor">
  <path d="M116,20V12a12,12,0,0,1,24,0v8a12,12,0,0,1-24,0Zm84,36a12,12,0,0,0,8.49-3.51l8-8a12,12,0,1,0-17-17l-8,8A12,12,0,0,0,200,56ZM47.51,52.49a12,12,0,0,0,17-17l-8-8a12,12,0,0,0-17,17ZM236,176v24a20,20,0,0,1-20,20H40a20,20,0,0,1-20-20V176a20,20,0,0,1,16-19.6V140a92,92,0,0,1,92-92h.71C179,48.38,220,90.1,220,141v15.4A20,20,0,0,1,236,176ZM60,140v16H196V141c0-37.77-30.27-68.72-67.48-69H128a68,68,0,0,0-68,68Zm152,40H44v16H212Zm-75.6-66.72a28,28,0,0,1,18.32,18.32,12,12,0,0,0,22.9-7.2,52,52,0,0,0-34-34,12,12,0,0,0-7.2,22.9Z"/>
</svg>`

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
  margin: 0;
  padding: 0;
}

body {
  width: 1200px;
  height: 630px;
  background: radial-gradient(circle at 18% 22%, #143522 0%, #0d1c12 52%, #07120a 100%);
  font-family: 'DM Sans', sans-serif;
  color: #e8eee9;
  overflow: hidden;
}

.og {
  width: 1200px;
  height: 630px;
  padding: 3.8rem 5.2rem 4.2rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1.8rem;
  border-bottom: 1px solid rgba(212, 229, 208, 0.18);
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.brand-logo {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
}

.brand-logo svg {
  width: 100%;
  height: 100%;
  display: block;
}

.brand-name {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 2rem;
  color: #ffffff;
  letter-spacing: -0.03em;
  line-height: 1;
}

.credit {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.92rem;
  font-weight: 500;
  color: #d4e5d0;
  background: rgba(255, 255, 255, 0.07);
  padding: 0.45rem 0.95rem;
  border-radius: 999px;
  border: 1px solid rgba(212, 229, 208, 0.22);
}

.credit svg {
  height: 15px;
  width: auto;
}

.main-grid {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 3.5rem;
  align-items: center;
  flex: 1;
  padding-top: 1.8rem;
}

.emergency-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(180, 35, 24, 0.25);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #fca5a5;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  letter-spacing: 0.01em;
  margin-bottom: 1.25rem;
}

.emergency-badge svg {
  width: 17px;
  height: 17px;
}

.hero-title {
  font-family: 'Outfit', sans-serif;
  font-size: 3.25rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: #ffffff;
  margin-bottom: 1rem;
}

.hero-subhead {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.2rem;
  font-weight: 400;
  line-height: 1.45;
  color: #c5d0c8;
  max-width: 44ch;
  margin-bottom: 1.8rem;
}

.step-chips {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.step-chip {
  display: inline-flex;
  align-items: center;
  background: rgba(212, 229, 208, 0.1);
  border: 1px solid rgba(212, 229, 208, 0.24);
  color: #e8eee9;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.92rem;
  font-weight: 600;
  padding: 0.45rem 0.95rem;
  border-radius: 999px;
  letter-spacing: 0.01em;
}

.preview-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
}

.preview-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(212, 229, 208, 0.22);
  border-radius: 18px;
  padding: 1.75rem 1.85rem;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  width: 100%;
}

.preview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-case {
  font-family: 'DM Mono', monospace;
  font-size: 1.05rem;
  font-weight: 500;
  color: #d4e5d0;
  letter-spacing: 0.02em;
}

.preview-status {
  background: rgba(180, 83, 9, 0.25);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #fde68a;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
}

.pipeline-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-top: 1px solid rgba(212, 229, 208, 0.12);
  border-bottom: 1px solid rgba(212, 229, 208, 0.12);
}

.pipeline-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  flex: 1;
  position: relative;
}

.pipeline-step-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(212, 229, 208, 0.2);
  border: 2px solid rgba(212, 229, 208, 0.4);
}

.pipeline-step-dot.done {
  background: #2f5d3a;
  border-color: #d4e5d0;
}

.pipeline-step-dot.active {
  background: #d97706;
  border-color: #fde68a;
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.25);
}

.pipeline-step-label {
  font-size: 0.72rem;
  font-weight: 500;
  color: #9aaba0;
}

.pipeline-step-label.done {
  color: #d4e5d0;
}

.pipeline-step-label.active {
  color: #fde68a;
  font-weight: 600;
}

.facts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.65rem;
}

.fact-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(212, 229, 208, 0.12);
  border-radius: 8px;
  padding: 0.55rem 0.85rem;
}

.fact-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: #9aaba0;
}

.fact-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: #ffffff;
}
</style>
</head>
<body>
<div class="og">
  <div class="top-bar">
    <div class="brand-lockup">
      <div class="brand-logo">${sanctuaryLogoSvg}</div>
      <div class="brand-name">Sanctuary</div>
    </div>

    <div class="credit">
      <span>A free software by The Mohsin Project</span>
      ${mohsinLogoSvg}
    </div>
  </div>

  <div class="main-grid">
    <div>
      <div class="emergency-badge">
        ${sirenIconSvg}
        <span>Emergency Rescue Network</span>
      </div>
      <h1 class="hero-title">Report an Animal in Distress.</h1>
      <p class="hero-subhead">Instant dispatch routing to field rescuers, clinics, and shelter teams across Pakistan.</p>
      <div class="step-chips">
        <span class="step-chip">1. Animal &amp; Injury</span>
        <span class="step-chip">2. Location &amp; GPS</span>
        <span class="step-chip">3. Instant Live Tracking</span>
      </div>
    </div>

    <div class="preview-wrap">
      <div class="preview-card">
        <div class="preview-head">
          <span class="preview-case">Case #REC-0842</span>
          <span class="preview-status">Dispatched</span>
        </div>

        <div class="pipeline-row">
          <div class="pipeline-step">
            <div class="pipeline-step-dot done"></div>
            <span class="pipeline-step-label done">Logged</span>
          </div>
          <div class="pipeline-step">
            <div class="pipeline-step-dot done"></div>
            <span class="pipeline-step-label done">Accepted</span>
          </div>
          <div class="pipeline-step">
            <div class="pipeline-step-dot active"></div>
            <span class="pipeline-step-label active">Dispatched</span>
          </div>
          <div class="pipeline-step">
            <div class="pipeline-step-dot"></div>
            <span class="pipeline-step-label">Attended</span>
          </div>
          <div class="pipeline-step">
            <div class="pipeline-step-dot"></div>
            <span class="pipeline-step-label">Resolved</span>
          </div>
        </div>

        <div class="facts-grid">
          <div class="fact-item">
            <span class="fact-label">Animal</span>
            <span class="fact-value">Dog · 1 in distress</span>
          </div>
          <div class="fact-item">
            <span class="fact-label">Location</span>
            <span class="fact-value">Gulberg III, Lahore</span>
          </div>
          <div class="fact-item">
            <span class="fact-label">Responder</span>
            <span class="fact-value">Field Unit 2 en route</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`

const tempHtmlPath = join(root, 'scripts/.temp-og-report.html')
const tempPngPath = join(root, 'scripts/.temp-og-report.png')
const targetJpgPath = join(root, 'public/og-report.jpg')

writeFileSync(tempHtmlPath, html, 'utf8')

const chromeBin =
  process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome'

console.log('Generating OG report image via Chrome screenshot...')
execSync(
  `"${chromeBin}" --headless=new --no-sandbox --disable-gpu --force-device-scale-factor=1 --hide-scrollbars --screenshot="${tempPngPath}" --window-size=1200,630 "file://${tempHtmlPath}"`,
  { stdio: 'inherit' }
)

console.log('Converting to JPEG...')
if (process.platform === 'darwin') {
  execSync(
    `sips -s format jpeg -s formatOptions 92 "${tempPngPath}" --out "${targetJpgPath}"`,
    { stdio: 'inherit' }
  )
} else {
  execSync(
    `convert "${tempPngPath}" -quality 92 "${targetJpgPath}"`,
    { stdio: 'inherit' }
  )
}

// Cleanup
try {
  unlinkSync(tempHtmlPath)
  unlinkSync(tempPngPath)
} catch {}

console.log(`Successfully updated ${targetJpgPath}!`)
