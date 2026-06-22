import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, 'flow-of-funds.html');
const pdfPath = join(__dirname, 'SANOVA-Flow-of-Funds.pdf');

const html = readFileSync(htmlPath, 'utf8');

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' }
  });
  console.log(`PDF written: ${pdfPath}`);
} finally {
  await browser.close();
}
