import { jsPDF } from 'jspdf';
import { ebookTipoLabel, formatEbookDateBr, type EbookPhoto } from '../services/ebookService';

/** Ideal por ebook no navegador; acima disso o aviso reforça o uso de filtros. */
export const EBOOK_PDF_SOFT_LIMIT = 80;
/** Acima disso pedimos confirmação, risco alto de travar a aba. */
export const EBOOK_PDF_HARD_LIMIT = 150;

const MAX_IMG_EDGE = 1600;
const JPEG_QUALITY = 0.82;

function wrapText(pdf: jsPDF, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['—'];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (pdf.getTextWidth(next) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function imageToJpegDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`Falha ao carregar foto (${res.status}).`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, MAX_IMG_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível no navegador.');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return {
      dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function drawMetaBlock(
  pdf: jsPDF,
  photo: EbookPhoto,
  x: number,
  yStart: number,
  maxWidth: number,
): void {
  const rows: Array<[string, string]> = [
    ['Loja', photo.loja || '—'],
    ['UF', photo.uf || '—'],
    ['Data', formatEbookDateBr(photo.data)],
    ['Indústria', photo.industria || '—'],
    ['Promotor', photo.promotor || '—'],
    ['Tipo', ebookTipoLabel(photo)],
    ['Senha do dia', photo.senhaDoDia || '—'],
  ];

  let y = yStart;
  for (const [label, value] of rows) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(label.toUpperCase(), x, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(20);
    const lines = wrapText(pdf, value, maxWidth);
    for (const line of lines.slice(0, 4)) {
      pdf.text(line, x, y);
      y += 5.2;
    }
    y += 3.5;
  }
}

export type EbookPdfProgress = (done: number, total: number) => void;

/** Gera PDF landscape A4 página a página (sem html2canvas), mais leve para dezenas de fotos. */
export async function buildEbookPdf(
  photos: EbookPhoto[],
  onProgress?: EbookPdfProgress,
): Promise<jsPDF> {
  if (photos.length === 0) throw new Error('Nenhuma foto selecionada.');

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const gap = 8;
  const metaW = 78;
  const imgAreaW = pageW - margin * 2 - metaW - gap;
  const imgAreaH = pageH - margin * 2 - 10;

  for (let i = 0; i < photos.length; i += 1) {
    if (i > 0) pdf.addPage();
    const photo = photos[i];

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(110);
    pdf.text(`GALERIA DE FOTOS · PÁGINA ${i + 1}/${photos.length}`, margin, margin + 2);

    try {
      const { dataUrl, width, height } = await imageToJpegDataUrl(photo.url);
      const ratio = Math.min(imgAreaW / width, imgAreaH / height);
      const drawW = width * ratio;
      const drawH = height * ratio;
      const imgX = margin + (imgAreaW - drawW) / 2;
      const imgY = margin + 8 + (imgAreaH - drawH) / 2;
      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(margin, margin + 6, imgAreaW, imgAreaH, 2, 2, 'F');
      pdf.addImage(dataUrl, 'JPEG', imgX, imgY, drawW, drawH, undefined, 'FAST');
    } catch {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(150);
      pdf.text('Foto indisponível', margin + 8, margin + 40);
    }

    drawMetaBlock(pdf, photo, margin + imgAreaW + gap, margin + 14, metaW);

    onProgress?.(i + 1, photos.length);
    // Libera a UI entre páginas
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
  }

  return pdf;
}