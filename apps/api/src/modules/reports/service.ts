import PDFDocument from "pdfkit";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { Photo } from "@prisma/client";
import { prisma } from "../../config/db";
import { HttpError } from "../../middleware/errorHandler";
import { ensureUploadSubdir, absolutePathFor } from "../../utils/storage";

function formatDate(date: Date): string {
  return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

const THUMB = 150;
const GAP = 12;
const PER_ROW = 3;
const CAPTION_H = 22;
const CELL_H = THUMB + CAPTION_H + GAP;

function drawPhotoGrid(doc: PDFKit.PDFDocument, photos: Photo[]): void {
  if (photos.length === 0) {
    doc.fontSize(9).fillColor("gray").text("Aucune photo pour ce point.");
    doc.fillColor("black");
    return;
  }

  const left = doc.page.margins.left;
  let rowTop = doc.y;

  photos.forEach((photo, index) => {
    const col = index % PER_ROW;
    if (col === 0 && index !== 0) {
      rowTop += CELL_H;
    }
    if (rowTop + CELL_H > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      rowTop = doc.page.margins.top;
    }

    const x = left + col * (THUMB + GAP);
    const absPhotoPath = absolutePathFor(photo.filePath);
    if (fs.existsSync(absPhotoPath)) {
      try {
        doc.image(absPhotoPath, x, rowTop, { fit: [THUMB, THUMB] });
      } catch {
        doc.rect(x, rowTop, THUMB, THUMB).stroke("#cccccc");
        doc
          .fontSize(8)
          .fillColor("red")
          .text("Image illisible", x, rowTop + THUMB / 2 - 5, { width: THUMB, align: "center" });
        doc.fillColor("black");
      }
    }
    doc
      .fontSize(8)
      .fillColor("gray")
      .text(formatDate(photo.takenAt), x, rowTop + THUMB + 4, { width: THUMB, align: "center" });
    doc.fillColor("black");
  });

  doc.x = left;
  doc.y = rowTop + CELL_H + 8;
}

export async function generateChantierReport(chantierId: string, generatedById: string) {
  const chantier = await prisma.chantier.findUnique({
    where: { id: chantierId },
    include: {
      plans: {
        include: {
          points: {
            include: {
              photos: { where: { blocageId: null }, orderBy: { takenAt: "asc" } },
              blocages: { include: { photos: { orderBy: { takenAt: "asc" } } }, orderBy: { createdAt: "asc" } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (!chantier) throw new HttpError(404, "Chantier introuvable");

  const dir = ensureUploadSubdir("reports");
  const fileName = `${crypto.randomUUID()}.pdf`;
  const absPath = path.join(dir, fileName);

  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(absPath);
  doc.pipe(stream);

  doc.fontSize(20).text(chantier.name, { underline: true });
  if (chantier.address) doc.fontSize(11).text(chantier.address);
  if (chantier.description) doc.fontSize(11).text(chantier.description);
  doc.moveDown();
  doc.fontSize(10).fillColor("gray").text(`Rapport généré le ${formatDate(new Date())}`);
  doc.fillColor("black");

  const allBlocages = chantier.plans.flatMap((plan) => plan.points.flatMap((point) => point.blocages.map((blocage) => ({ ...blocage, pointIdentifiant: point.identifiant }))));
  doc.moveDown();
  doc.fontSize(15).text("Blocages / anomalies", { underline: true });
  if (allBlocages.length === 0) {
    doc.fontSize(9).fillColor("gray").text("Aucun blocage signalé sur ce chantier.");
    doc.fillColor("black");
  } else {
    for (const blocage of allBlocages) {
      doc.fontSize(10).fillColor("black").text(`${blocage.pointIdentifiant} · ${blocage.titre}`);
      doc.fontSize(8).fillColor("gray").text(`${blocage.statut} · Priorité ${blocage.priorite} · ${formatDate(blocage.createdAt)}`);
      doc.fontSize(9).fillColor("black").text(blocage.description);
      doc.moveDown(0.4);
    }
  }

  for (const plan of chantier.plans) {
    doc.addPage();
    doc.fontSize(16).text(`Plan : ${plan.fileName}`, { underline: true });
    doc.moveDown();

    if (plan.points.length === 0) {
      doc.fontSize(11).fillColor("gray").text("Aucun point sur ce plan.");
      doc.fillColor("black");
      continue;
    }

    for (const point of plan.points) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 120) {
        doc.addPage();
      } else {
        doc.moveDown();
      }

      doc
        .fontSize(13)
        .text(`${point.type ? `[${point.type}] ` : ""}${point.identifiant}${point.nom ? ` — ${point.nom}` : ""}`);
      doc
        .fontSize(9)
        .fillColor("gray")
        .text(`Statut : ${point.statut}    ·    Ajouté le ${formatDate(point.createdAt)}`);
      if (point.commentaire) {
        doc.fontSize(10).fillColor("black").text(`Commentaire : ${point.commentaire}`);
      }
      if (point.blocages.length > 0) {
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor("#9b2c2c").text("Blocages / anomalies");
        for (const blocage of point.blocages) {
          doc.fontSize(10).fillColor("black").text(`${blocage.titre} · ${blocage.statut} · Priorité ${blocage.priorite}`);
          doc.fontSize(9).text(`${blocage.description} · Signalé le ${formatDate(blocage.createdAt)}`);
          if (blocage.photos.length > 0) {
            doc.fontSize(8).fillColor("gray").text("Photos du blocage :");
            drawPhotoGrid(doc, blocage.photos);
          }
        }
      }
      doc.fillColor("black");
      doc.moveDown(0.5);

      drawPhotoGrid(doc, point.photos);
    }
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  const report = await prisma.report.create({
    data: {
      chantierId: chantier.id,
      filePath: path.join("reports", fileName),
      generatedById,
    },
    include: { chantier: true, generatedBy: true },
  });

  return report;
}
