import * as pdfjsLib from 'pdfjs-dist';

// Use the worker from the installed package
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Extract text from a single PDF file.
 * Returns an array of { page, text } objects.
 */
export async function extractTextFromPDF(url, magazineName) {
  const pdf = await pdfjsLib.getDocument(url).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(' ');

    if (text.trim().length > 0) {
      pages.push({
        magazine: magazineName,
        page: i,
        totalPages: pdf.numPages,
        text: text.trim(),
      });
    }
  }

  return pages;
}

/**
 * Extract text from multiple PDFs.
 * Takes an array of { url, name } objects.
 */
export async function extractAllPDFs(pdfs, onProgress) {
  const allPages = [];
  let processed = 0;

  for (const pdf of pdfs) {
    try {
      const pages = await extractTextFromPDF(pdf.url, pdf.name);
      allPages.push(...pages);
    } catch (err) {
      console.error(`Failed to extract ${pdf.name}:`, err);
    }
    processed++;
    if (onProgress) {
      onProgress(processed, pdfs.length);
    }
  }

  return allPages;
}
