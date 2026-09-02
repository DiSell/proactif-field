import PDFDocument from "pdfkit";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { prisma } from "../../config/db";
import { HttpError } from "../../middleware/errorHandler";
import { ensureUploadSubdir } from "../../utils/storage";
import { drawOrganizationHeader, drawPhotoGrid, formatDate } from "../reports/service";
import { logRapportTerrainActivityAsync } from "./activity";

function formatGps(lat: number | null, lng: number | null, accuracy: number | null): string | null {
  if (lat == null || lng == null) return null;
  const precision = accuracy != null ? ` (± ${Math.round(accuracy)} m)` : "";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}${precision}`;
}

// Dedicated generator — deliberately not a branch of generateChantierReport,
// which walks chantier → plans → points and would need a fake plan/point to
// describe a field report's flatter shape. Reuses drawOrganizationHeader /
// drawPhotoGrid / formatDate from the chantier report module where the
// output should look identical (masthead, date formatting, photo grid).
export async function generateFieldReportPdf(rapportTerrainId: string, generatedById: string) {
  const rapport = await prisma.rapportTerrain.findUnique({
    where: { id: rapportTerrainId },
    include: {
      organization: true,
      createdBy: true,
      items: {
        include: { photos: { orderBy: { takenAt: "asc" } }, createdBy: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!rapport) throw new HttpError(404, "Rapport terrain introuvable");

  const dir = ensureUploadSubdir("rapport-terrain-pdfs");
  const fileName = `${crypto.randomUUID()}.pdf`;
  const absPath = path.join(dir, fileName);

  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(absPath);
  doc.pipe(stream);

  await drawOrganizationHeader(doc, rapport.organization);
  doc.moveDown().fillColor("black").fontSize(20).text(rapport.nom, { underline: true });

  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("gray").text(`Rapport du ${formatDate(rapport.createdAt)} · ${rapport.createdBy.name}`);
  if (rapport.typeTravaux) doc.fontSize(10).fillColor("black").text(`Type de travaux : ${rapport.typeTravaux}`);
  if (rapport.lieu) doc.fontSize(10).fillColor("black").text(`Lieu : ${rapport.lieu}`);
  const gps = formatGps(rapport.latitude, rapport.longitude, rapport.gpsAccuracy);
  if (gps) doc.fontSize(9).fillColor("gray").text(`GPS : ${gps}`);
  doc.fillColor("black");
  if (rapport.observation) {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("black").text(rapport.observation);
  }

  if (rapport.items.length === 0) {
    doc.moveDown();
    doc.fontSize(11).fillColor("gray").text("Aucune entrée pour ce rapport.");
    doc.fillColor("black");
  }

  for (const item of rapport.items) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 120) {
      doc.addPage();
    } else {
      doc.moveDown();
    }

    doc.fontSize(13).fillColor("black").text(item.titre || "Entrée sans intitulé");
    const itemGps = formatGps(item.latitude, item.longitude, item.gpsAccuracy);
    doc.fontSize(9).fillColor("gray").text([formatDate(item.capturedAt), itemGps].filter(Boolean).join("    ·    "));
    if (item.commentaire) {
      doc.fontSize(10).fillColor("black").text(item.commentaire);
    }
    doc.fillColor("black");
    doc.moveDown(0.5);

    drawPhotoGrid(doc, item.photos);
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  const pdf = await prisma.rapportTerrainPdf.create({
    data: {
      rapportTerrainId: rapport.id,
      filePath: path.join("rapport-terrain-pdfs", fileName),
      generatedById,
    },
    include: { generatedBy: true },
  });

  logRapportTerrainActivityAsync({ organizationId: rapport.organizationId, rapportTerrainId: rapport.id, userId: generatedById, action: "RAPPORT_TERRAIN_GENERE", metadata: { pdfId: pdf.id } });

  return pdf;
}
