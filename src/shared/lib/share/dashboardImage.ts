import { toPng } from 'html-to-image'

export async function renderDashboardImage(
  element: HTMLElement,
): Promise<Blob> {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#F5F1E8',
  })
  const res = await fetch(dataUrl)
  return res.blob()
}
