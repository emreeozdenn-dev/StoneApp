import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export interface PlateInfoItem {
  plateId: number
  plateNo: string
  stoneName: string
  widthCm: number
  heightCm: number
  thicknessCm: number
  color: string
  texture: string
  imageUrl: string | null | undefined
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function fitWithinBox(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1)
  return { width: width * scale, height: height * scale }
}

// Kartlar, gerçek DOM görünümünden (görsel üstte, bilgiler altta) yakalanır; böylece
// Türkçe karakterler tarayıcının kendi yazı tipiyle doğru render edilir. Görsel artık
// object-fit yerine genişlik bazlı doğal oranla gösterildiği için sündürme olmaz.
// Sayfa yatay (landscape) ve her sayfada yalnızca bir kayıt gösterilir.
export async function exportPlateInfoPdf(cardElements: HTMLElement[], fileName = 'plaka-bilgisi.pdf') {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 16
  const maxWidth = pageWidth - margin * 2
  const maxHeight = pageHeight - margin * 2

  for (let i = 0; i < cardElements.length; i++) {
    const canvas = await html2canvas(cardElements[i], { useCORS: true, backgroundColor: '#ffffff', scale: 2 })
    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    const { width: imgWidth, height: imgHeight } = fitWithinBox(canvas.width, canvas.height, maxWidth, maxHeight)
    const x = margin + (maxWidth - imgWidth) / 2
    const y = margin + (maxHeight - imgHeight) / 2

    if (i > 0) pdf.addPage()
    pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight)
  }

  pdf.save(fileName)
}

// Teklif önizlemesi tek bir belge olduğu için (taş başına ayrı sayfa değil), uzun
// içerik gerektiğinde ekran görüntüsü dikey olarak sayfa yüksekliği kadar dilimlenip
// birden fazla sayfaya bölünür. İndirme (exportOfferPdf) ve e-posta eki (generateOfferPdfBlob)
// aynı belge üretimini paylaşır.
async function buildOfferPdf(containerElement: HTMLElement): Promise<jsPDF> {
  const canvas = await html2canvas(containerElement, { useCORS: true, backgroundColor: '#ffffff', scale: 2 })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - margin * 2
  const contentHeight = pageHeight - margin * 2

  const pxPerMm = canvas.width / contentWidth
  const pageHeightPx = Math.floor(contentHeight * pxPerMm)

  let renderedHeight = 0
  let pageIndex = 0
  while (renderedHeight < canvas.height) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedHeight)
    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = sliceHeightPx
    const ctx = sliceCanvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
      ctx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)
      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92)
      const sliceHeightMm = sliceHeightPx / pxPerMm

      if (pageIndex > 0) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, sliceHeightMm)
    }

    renderedHeight += sliceHeightPx
    pageIndex++
  }

  return pdf
}

export async function exportOfferPdf(containerElement: HTMLElement, fileName = 'teklif.pdf') {
  const pdf = await buildOfferPdf(containerElement)
  pdf.save(fileName)
}

export async function generateOfferPdfBlob(containerElement: HTMLElement): Promise<Blob> {
  const pdf = await buildOfferPdf(containerElement)
  return pdf.output('blob')
}

export function buildPlateInfoWhatsAppText(items: PlateInfoItem[]): string {
  return items
    .map((item) =>
      [
        item.stoneName,
        `En x Boy: ${item.widthCm.toLocaleString('tr-TR')} x ${item.heightCm.toLocaleString('tr-TR')} cm`,
        `Kalınlık: ${item.thicknessCm.toLocaleString('tr-TR')} cm`,
        `Renk: ${item.color}`,
        `Doku: ${item.texture}`,
      ].join('\n'),
    )
    .join('\n\n')
}

// WhatsApp'ın "click-to-chat" bağlantısı (wa.me) yalnızca önceden doldurulmuş metin
// gönderebilir, dosya ekleyemez — bu WhatsApp'ın web için sunduğu tek yol. Gerçek bir
// JPEG dosyası göndermek için tarayıcının Web Share API'si kullanılır (navigator.share);
// bu, JPEG'i doğrudan WhatsApp'ın paylaşım sayfasına dosya olarak aktarır. Bu API
// yalnızca HTTPS üzerinde ve çoğunlukla mobil tarayıcılarda (bazı masaüstü Chromium
// tarayıcılarında da) desteklenir; desteklenmediğinde metinli wa.me bağlantısına geri
// düşülür.
export function openPlateInfoWhatsApp(items: PlateInfoItem[]) {
  const text = buildPlateInfoWhatsAppText(items)
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
}

async function generateCardJpegBlob(cardElement: HTMLElement): Promise<Blob | null> {
  const canvas = await html2canvas(cardElement, { useCORS: true, backgroundColor: '#ffffff', scale: 2 })
  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
}

// Her kayıt için ayrı bir JPEG dosyası indirilir (sayfa/dosya başına 1 kayıt).
export async function exportPlateInfoJpeg(cardElements: HTMLElement[], fileNamePrefix = 'plaka-bilgisi') {
  for (let i = 0; i < cardElements.length; i++) {
    const blob = await generateCardJpegBlob(cardElements[i])
    if (blob) {
      const fileName = cardElements.length > 1 ? `${fileNamePrefix}-${i + 1}.jpg` : `${fileNamePrefix}.jpg`
      downloadBlob(blob, fileName)
    }
  }
}

export type ShareJpegToWhatsAppResult = 'shared' | 'cancelled' | 'unsupported'

// Fotoğraf + tablo bilgisi zaten JPEG'in içinde olduğu için ayrıca metin (caption)
// gönderilmez — aksi halde WhatsApp'ta aynı bilgiler hem görselde hem altında tekrar
// yazı olarak görünürdü.
export async function sharePlateInfoJpegToWhatsApp(
  cardElements: HTMLElement[],
  fileNamePrefix = 'plaka-bilgisi',
): Promise<ShareJpegToWhatsAppResult> {
  const files: File[] = []
  for (let i = 0; i < cardElements.length; i++) {
    const blob = await generateCardJpegBlob(cardElements[i])
    if (blob) {
      const fileName = cardElements.length > 1 ? `${fileNamePrefix}-${i + 1}.jpg` : `${fileNamePrefix}.jpg`
      files.push(new File([blob], fileName, { type: 'image/jpeg' }))
    }
  }
  if (files.length === 0) return 'unsupported'

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }

  if (nav.canShare && nav.share && nav.canShare({ files })) {
    try {
      await nav.share({ files, title: 'Plaka Bilgisi' })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
      throw err
    }
  }

  return 'unsupported'
}
