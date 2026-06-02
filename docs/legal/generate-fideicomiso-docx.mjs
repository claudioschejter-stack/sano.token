import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, 'CONTRATO-MATRIZ-SANOVA-GLOBAL-RWA-FUENTE.txt');
const outputPath = path.join(
  __dirname,
  'CONTRATO MATRIZ DE FIDEICOMISO SANOVA GLOBAL RWA - VERSION INTEGRADA.docx'
);

const raw = fs.readFileSync(sourcePath, 'utf8');
const lines = raw.split(/\r?\n/);

function paragraphForLine(line) {
  const trimmed = line.trimEnd();
  if (!trimmed) {
    return new Paragraph({ spacing: { after: 120 } });
  }
  if (trimmed.startsWith('### ')) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: trimmed.slice(4), bold: true })]
    });
  }
  if (trimmed.startsWith('## ')) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 160 },
      children: [new TextRun({ text: trimmed.slice(3), bold: true, size: 28 })]
    });
  }
  if (trimmed.startsWith('# ')) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 },
      children: [new TextRun({ text: trimmed.slice(2), bold: true, size: 32 })]
    });
  }
  if (/^CLÁUSULA \d+/i.test(trimmed) || /^ANEXO [IVX]+/i.test(trimmed)) {
    return new Paragraph({
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: trimmed, bold: true })]
    });
  }
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 276 },
    children: [new TextRun({ text: trimmed, size: 22 })]
  });
}

const children = lines.map(paragraphForLine);

const doc = new Document({
  creator: 'Sanova Global SAS',
  title: 'Contrato Matriz de Fideicomiso Sanova Global RWA',
  description: 'Versión integrada — borrador para revisión legal',
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'BORRADOR — REVISIÓN ABOGADO / ESCRIBANO / CONTADOR',
                  italics: true,
                  size: 18,
                  color: '666666'
                })
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Página ', size: 18 }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18 })
              ]
            })
          ]
        })
      },
      children: [
        new Paragraph({
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: 'Documento informativo-contractual. No constituye asesoramiento legal. Debe ser revisado por profesionales matriculados antes de firma.',
              italics: true,
              size: 20
            })
          ]
        }),
        ...children
      ]
    }
  ]
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log(`Generado: ${outputPath}`);
