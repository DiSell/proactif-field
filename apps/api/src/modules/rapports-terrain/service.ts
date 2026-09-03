import PDFDocument from "pdfkit";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { prisma } from "../../config/db";
import { HttpError } from "../../middleware/errorHandler";
import { ensureUploadSubdir } from "../../utils/storage";
import { drawFooters, drawInfoLine, drawOrganizationHeader, drawPhotoGrid, drawSectionTitle, formatDate, PDF_COLORS } from "../reports/service";
import { logRapportTerrainActivityAsync } from "./activity";

function formatGps(lat: number | null, lng: number | null, accuracy: number | null): string | null {
  if (lat == null || lng == null) return null;
  const precision = accuracy != null ? ` (± ${Math.round(accuracy)} m)` : "";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}${precision}`;
}

// Dedicated generator — deliberately not a branch of generateChantierReport,
// which walks chantier → plans → points and would need a fake plan/point to
// describe a field report's flatter shape. Reuses the same masthead, photo
// grid, section-title and footer helpers so the two report types look like
// one consistent product, not two different tools bolted together.
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

  const doc = new PDFDocument({ margin: 50, bufferPages: true });
  const stream = fs.createWriteStream(absPath);
  doc.pipe(stream);

  await drawOrganizationHeader(doc, rapport.organization);

  doc.font("Helvetica-Bold").fontSize(21).fillColor(PDF_COLORS.ink).text(rapport.nom);
  doc.font("Helvetica").fillColor(PDF_COLORS.muted).fontSize(9).text(`Rapport du ${formatDate(rapport.createdAt)} · ${rapport.createdBy.name}`);
  doc.moveDown(0.8);

  const gps = formatGps(rapport.latitude, rapport.longitude, rapport.gpsAccuracy);
  if (rapport.typeTravaux) drawInfoLine(doc, "Type de travaux", rapport.typeTravaux);
  if (rapport.lieu) drawInfoLine(doc, "Lieu", rapport.lieu);
  if (gps) drawInfoLine(doc, "GPS", gps);
  doc.moveDown(0.2);

  if (rapport.observation) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(PDF_COLORS.muted).text("OBSERVATION GÉNÉRALE", { characterSpacing: 0.4 });
    doc.font("Helvetica").fontSize(10.5).fillColor(PDF_COLORS.ink).text(rapport.observation);
    doc.fillColor("black");
    doc.moveDown(0.6);
  }

  doc.moveDown(0.3);
  drawSectionTitle(doc, `Points relevés (${rapport.items.length})`);

  if (rapport.items.length === 0) {
    doc.fontSize(11).fillColor(PDF_COLORS.faint).text("Aucune entrée pour ce rapport.");
    doc.fillColor("black");
  }

  rapport.items.forEach((item, index) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 120) {
      doc.addPage();
    } else if (index > 0) {
      doc.moveDown(0.8);
    }

    // No item-level GPS line here on purpose: GPS is captured per photo
    // (RapportTerrainPhoto.gpsLat/Lng), never on the item itself — it's
    // drawn under each thumbnail in drawPhotoGrid below instead.
    doc.font("Helvetica-Bold").fontSize(13).fillColor(PDF_COLORS.ink).text(`${index + 1}. ${item.titre || "Entrée sans intitulé"}`);
    doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.muted).text(formatDate(item.capturedAt));
    if (item.commentaire) {
      doc.fontSize(10).fillColor(PDF_COLORS.ink).text(item.commentaire);
    }
    doc.fillColor("black");
    doc.moveDown(0.5);

    drawPhotoGrid(doc, item.photos);
  });

  drawFooters(doc, rapport.organization.name);
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
