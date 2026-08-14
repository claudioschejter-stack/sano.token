#!/usr/bin/env node
/**
 * Generate KYB PDF pack from HTML sources in docs/compliance/kyb/
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = __dirname;

const docs = [
  { html: 'modelo-de-negocio-kyb.html', pdf: 'SANOVA-KYB-Modelo-de-Negocio.pdf' },
  { html: 'manual-pld-sanova.html', pdf: 'SANOVA-Manual-PLD.pdf' },
  { html: 'organigrama-corporativo.html', pdf: 'SANOVA-Organigrama-Corporativo.pdf' },
  { html: 'evidencia-aml-kyc.html', pdf: 'SANOVA-Evidencia-AML-KYC.pdf' },
];

mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  for (const doc of docs) {
    const html = readFileSync(join(outDir, doc.html), 'utf8');
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfPath = join(outDir, doc.pdf);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' },
    });
    await page.close();
    console.log(`PDF written: ${pdfPath}`);
  }
} finally {
  await browser.close();
}
