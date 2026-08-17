import PDFDocument from "pdfkit";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../../config/db";
import { HttpError } from "../../middleware/errorHandler";
import { ensureUploadSubdir, absolutePathFor } from "../../utils/storage";
import path from "path";

function formatDate(date: Date): string {
  return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function formatGps(lat: number | null, lng: number | null, accuracy: number | null): string {
  if (lat === null || lng === null) return "GPS indisponible";
  const precision = accuracy !== null ? ` (précision ~${Math.round(accuracy)} m)` : "";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}${precision}`;
}

export async function generateChantierReport(chantierId: string, generatedById: string) {
  const chantier = await prisma.chantier.findUnique({
    where: { id: chantierId },
    include: {
      plans: {
        include: {
          points: {
            include: { photos: { orderBy: { takenAt: "asc" } } },
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
      doc.moveDown();
      doc
        .fontSize(13)
        .text(`${point.type ? `[${point.type}] ` : ""}${point.identifiant}${point.nom ? ` — ${point.nom}` : ""}`);
      doc.fontSize(10).fillColor("gray").text(`Statut : ${point.statut}`);
      if (point.commentaire) doc.fontSize(10).fillColor("black").text(`Commentaire : ${point.commentaire}`);
      doc.fillColor("black");

      for (const photo of point.photos) {
        doc.moveDown(0.5);
        const absPhotoPath = absolutePathFor(photo.filePath);
        if (fs.existsSync(absPhotoPath)) {
          try {
            doc.image(absPhotoPath, { width: 200 });
          } catch {
            doc.fontSize(9).fillColor("red").text("(impossible d'afficher cette photo)");
            doc.fillColor("black");
          }
        }
        doc
          .fontSize(9)
          .fillColor("gray")
          .text(`Prise le ${formatDate(photo.takenAt)} — ${formatGps(photo.gpsLat, photo.gpsLng, photo.gpsAccuracy)}`);
        doc.fillColor("black");
      }
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
  });

  return report;
}
