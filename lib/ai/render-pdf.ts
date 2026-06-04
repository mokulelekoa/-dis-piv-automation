/**
 * Render the first N pages of a PDF to PNG (base64) via MuPDF, for vision OCR.
 * Ported from the Menehune document-parser.
 */
export async function renderPdfPagesAsPng(fileBuffer: Buffer, maxPages = 3): Promise<string[]> {
  try {
    const mupdf = await import('mupdf')
    const doc = mupdf.Document.openDocument(fileBuffer, 'application/pdf')
    const pageCount = Math.min(doc.countPages(), maxPages)
    if (pageCount === 0) return []
    const images: string[] = []
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i)
      // 2x resolution for better OCR quality
      const pixmap = page.toPixmap([2, 0, 0, 2, 0, 0], mupdf.ColorSpace.DeviceRGB, false, true)
      const pngBuffer = pixmap.asPNG()
      images.push(Buffer.from(pngBuffer).toString('base64'))
    }
    return images
  } catch (err) {
    console.error('[render-pdf] MuPDF render error:', err)
    return []
  }
}
