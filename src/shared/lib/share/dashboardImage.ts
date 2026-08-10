import { toPng } from 'html-to-image'

export const DASHBOARD_SHARE_CREDIT =
  'Shared with Sanctuary · nonprofit software by The Mohsin Project'

/** Instagram feed / square post size. */
export const DASHBOARD_SHARE_SIZE = 1080

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',', 2)
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/png'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function blobUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * html-to-image's cacheBust appends `?t=` which breaks blob: URLs and
 * forces network refetch of fonts — both fail when cloud/SW is unhappy.
 * Inline logos as data URLs first so capture stays fully local.
 */
async function inlineLocalImages(root: HTMLElement): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  const restorers: Array<() => void> = []

  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src')
      if (!src || (!src.startsWith('blob:') && !src.startsWith('data:'))) {
        return
      }
      if (src.startsWith('data:')) return

      const dataUrl = await blobUrlToDataUrl(src)
      if (!dataUrl) {
        // Drop broken local images rather than failing the whole export.
        const prevDisplay = img.style.display
        img.style.display = 'none'
        restorers.push(() => {
          img.style.display = prevDisplay
        })
        return
      }

      const prevSrc = img.src
      img.src = dataUrl
      restorers.push(() => {
        img.src = prevSrc
      })
    }),
  )

  return () => {
    for (const restore of restorers) restore()
  }
}

/**
 * Temporarily lay the live card out at the poster size so flex/grid and
 * export type sizes compute correctly. html-to-image's clone `style` width
 * alone left metrics at mobile width (character-wrapped amounts).
 */
export async function renderDashboardImage(
  element: HTMLElement,
): Promise<Blob> {
  const credit = document.createElement('div')
  credit.className = 'powered-by'
  credit.textContent = DASHBOARD_SHARE_CREDIT

  const prev = {
    width: element.style.width,
    height: element.style.height,
    maxWidth: element.style.maxWidth,
    position: element.style.position,
    left: element.style.left,
    top: element.style.top,
    right: element.style.right,
    bottom: element.style.bottom,
    zIndex: element.style.zIndex,
    margin: element.style.margin,
    transform: element.style.transform,
    transformOrigin: element.style.transformOrigin,
  }

  let restoreImages: (() => void) | null = null

  element.appendChild(credit)
  element.classList.add('dashboard-card--export')

  // Keep on-screen (fully off-screen clones blank in Chromium) and size to
  // the real poster dimensions so grid/type lay out at 1080, not mobile width.
  element.style.width = `${DASHBOARD_SHARE_SIZE}px`
  element.style.height = `${DASHBOARD_SHARE_SIZE}px`
  element.style.maxWidth = `${DASHBOARD_SHARE_SIZE}px`
  element.style.position = 'fixed'
  element.style.left = '0'
  element.style.top = '0'
  element.style.right = 'auto'
  element.style.bottom = 'auto'
  element.style.zIndex = '99999'
  element.style.margin = '0'
  element.style.transform = 'none'

  try {
    restoreImages = await inlineLocalImages(element)
    await document.fonts.ready
    await waitForPaint()

    const dataUrl = await toPng(element, {
      // Never cache-bust: breaks blob: logos and forces network font refetch.
      cacheBust: false,
      pixelRatio: 1,
      width: DASHBOARD_SHARE_SIZE,
      height: DASHBOARD_SHARE_SIZE,
      canvasWidth: DASHBOARD_SHARE_SIZE,
      canvasHeight: DASHBOARD_SHARE_SIZE,
      backgroundColor: '#e8eee9',
      style: {
        margin: '0',
        transform: 'none',
        width: `${DASHBOARD_SHARE_SIZE}px`,
        height: `${DASHBOARD_SHARE_SIZE}px`,
        maxWidth: `${DASHBOARD_SHARE_SIZE}px`,
        borderRadius: '0',
        border: 'none',
        boxShadow: 'none',
      },
    })
    return dataUrlToBlob(dataUrl)
  } finally {
    restoreImages?.()
    element.classList.remove('dashboard-card--export')
    credit.remove()
    element.style.width = prev.width
    element.style.height = prev.height
    element.style.maxWidth = prev.maxWidth
    element.style.position = prev.position
    element.style.left = prev.left
    element.style.top = prev.top
    element.style.right = prev.right
    element.style.bottom = prev.bottom
    element.style.zIndex = prev.zIndex
    element.style.margin = prev.margin
    element.style.transform = prev.transform
    element.style.transformOrigin = prev.transformOrigin
  }
}
