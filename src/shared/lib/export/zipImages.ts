import JSZip from 'jszip'

export type ExportCsvFile = {
  name: string
  content: string
}

export type ExportImage = {
  name: string
  blob: Blob
}

export async function buildExportZip(input: {
  csvFiles: ExportCsvFile[]
  images: ExportImage[]
}): Promise<Blob> {
  const zip = new JSZip()
  for (const file of input.csvFiles) {
    zip.file(file.name, file.content)
  }
  const imagesFolder = zip.folder('images')
  for (const image of input.images) {
    imagesFolder?.file(image.name, image.blob)
  }
  return zip.generateAsync({ type: 'blob' })
}
