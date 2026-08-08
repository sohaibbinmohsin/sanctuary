import { toPng } from 'html-to-image'

export const DASHBOARD_SHARE_CREDIT =
  'Shared with Sanctuary - a non profit software by The Mohsin Project'

export async function renderDashboardImage(
  element: HTMLElement,
): Promise<Blob> {
  const clone = element.cloneNode(true) as HTMLElement
  clone.setAttribute('aria-hidden', 'true')
  clone.style.position = 'fixed'
  clone.style.left = '-10000px'
  clone.style.top = '0'
  clone.style.width = `${element.offsetWidth}px`
  clone.style.margin = '0'
  clone.style.zIndex = '-1'

  const credit = document.createElement('div')
  credit.className = 'powered-by'
  credit.textContent = DASHBOARD_SHARE_CREDIT
  clone.appendChild(credit)

  document.body.appendChild(clone)
  try {
    const dataUrl = await toPng(clone, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#E8EEE9',
    })
    const res = await fetch(dataUrl)
    return res.blob()
  } finally {
    clone.remove()
  }
}
