import { toPng } from 'html-to-image'

export const DASHBOARD_SHARE_CREDIT =
  'Shared with Sanctuary - a non profit software by The Mohsin Project'

export async function renderDashboardImage(
  element: HTMLElement,
): Promise<Blob> {
  // Capture the live card. An off-screen fixed clone (left: -10000px) made
  // html-to-image return a blank PNG in Chromium.
  const credit = document.createElement('div')
  credit.className = 'powered-by'
  credit.textContent = DASHBOARD_SHARE_CREDIT
  element.appendChild(credit)

  try {
    const dataUrl = await toPng(element, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#E8EEE9',
      style: {
        // Ensure the node itself isn't treated as out-of-viewport.
        margin: '0',
      },
    })
    const res = await fetch(dataUrl)
    return res.blob()
  } finally {
    credit.remove()
  }
}
