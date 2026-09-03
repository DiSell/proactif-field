import archiver from "archiver";
import fs from "fs";
import { Response } from "express";
import { prisma } from "../../config/db";
import { HttpError } from "../../middleware/errorHandler";
import { absolutePathFor } from "../../utils/storage";
import { formatDate } from "../reports/service";

// Companion to the PDF: a PDF flattens photos into small embedded thumbnails
// and isn't something a recipient can easily pull individual full-size
// files or raw data out of. This streams a .zip with the original photo
// files (untouched, full resolution) plus a plain-text file of every
// field — so anyone who receives it, even without an account, can drop the
// photos straight into their own folder and copy the text.

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents after NFD decomposition
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "sans-titre";
}

function formatGps(lat: number | null, lng: number | null, accuracy: number | null): string {
  if (lat == null || lng == null) return "GPS indisponible";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}${accuracy != null ? ` (± ${Math.round(accuracy)} m)` : ""}`;
}

export async function streamFieldReportExport(rapportTerrainId: string, res: Response): Promise<void> {
  const rapport = await prisma.rapportTerrain.findUnique({
    where: { id: rapportTerrainId },
    include: {
      createdBy: true,
      items: {
        include: { photos: { orderBy: { takenAt: "asc" } }, createdBy: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!rapport) throw new HttpError(404, "Rapport terrain introuvable");

  const lines: string[] = [];
  lines.push(rapport.nom);
  lines.push("=".repeat(rapport.nom.length));
  lines.push(`Date : ${formatDate(rapport.createdAt)}`);
  lines.push(`Technicien : ${rapport.createdBy.name}`);
  if (rapport.typeTravaux) lines.push(`Type de travaux : ${rapport.typeTravaux}`);
  if (rapport.lieu) lines.push(`Lieu : ${rapport.lieu}`);
  lines.push(`GPS : ${formatGps(rapport.latitude, rapport.longitude, rapport.gpsAccuracy)}`);
  if (rapport.observation) lines.push(`Observation : ${rapport.observation}`);
  lines.push("");

  rapport.items.forEach((item, itemIndex) => {
    const folder = `${itemIndex + 1}-${slug(item.titre || "entree")}`;
    lines.push(`--- Point ${itemIndex + 1} : ${item.titre || "(sans intitulé)"} ---`);
    lines.push(`Date : ${formatDate(item.capturedAt)}`);
    if (item.commentaire) lines.push(`Commentaire : ${item.commentaire}`);
    if (item.photos.length === 0) lines.push("Photos : aucune");
    item.photos.forEach((photo, photoIndex) => {
      lines.push(`Photo ${photoIndex + 1} : photos/${folder}/photo-${photoIndex + 1}${extOf(photo.filePath)} — GPS ${formatGps(photo.gpsLat, photo.gpsLng, photo.gpsAccuracy)} — ${formatDate(photo.takenAt)}`);
    });
    lines.push("");
  });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${slug(rapport.nom)}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    console.error("Erreur lors de la génération de l'archive du rapport terrain", err);
    res.destroy(err);
  });
  archive.pipe(res);

  archive.append(lines.join("\n"), { name: "informations.txt" });

  rapport.items.forEach((item, itemIndex) => {
    const folder = `${itemIndex + 1}-${slug(item.titre || "entree")}`;
    item.photos.forEach((photo, photoIndex) => {
      const absPath = absolutePathFor(photo.filePath);
      if (fs.existsSync(absPath)) {
        archive.file(absPath, { name: `photos/${folder}/photo-${photoIndex + 1}${extOf(photo.filePath)}` });
      }
    });
  });

  await archive.finalize();
}

function extOf(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  return dot === -1 ? ".jpg" : filePath.slice(dot);
}
