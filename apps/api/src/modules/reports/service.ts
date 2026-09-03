import PDFDocument from "pdfkit";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { prisma } from "../../config/db";
import { HttpError } from "../../middleware/errorHandler";
import { ensureUploadSubdir, absolutePathFor } from "../../utils/storage";
import sharp from "sharp";
import { logActivityAsync } from "../activity/service";

export function formatDate(date: Date): string {
  return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

// Shared palette for every generated PDF — echoes the web app's own
// "professional dossier" chrome (dashboard/chantier header colors in
// index.css) so a report doesn't look like a different, older product.
export const PDF_COLORS = {
  ink: "#17263d",
  muted: "#647289",
  faint: "#8a96a8",
  accent: "#2167d5",
  rule: "#dfe6ef",
  danger: "#a32b25",
  success: "#247542",
} as const;

const THUMB = 150;
const GAP = 14;
const PER_ROW = 3;
const CAPTION_H = 30;
const CELL_H = THUMB + CAPTION_H + GAP;

// Bold colored heading + a thin rule underneath, replacing the old
// underlined-text style used for every section ("Blocages", "Matériel",
// "Plan : …", the report title itself) — one consistent, less dated look
// everywhere instead of each call site styling itself differently.
export function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, options: { size?: number } = {}): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const size = options.size ?? 13;
  doc.font("Helvetica-Bold").fontSize(size).fillColor(PDF_COLORS.ink).text(title, left, doc.y, { width });
  doc.moveDown(0.3);
  doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(1).strokeColor(PDF_COLORS.rule).stroke();
  doc.moveDown(0.5);
  doc.font("Helvetica").fillColor("black");
}

// A compact "LABEL / value" pair, label styled like the web app's own
// dt/dd metadata blocks (small, bold, muted) — used for report/chantier
// header fields instead of a flat "Label : value" line so key information
// actually reads as structured data, not a paragraph.
export function drawInfoLine(doc: PDFKit.PDFDocument, label: string, value: string): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(PDF_COLORS.muted).text(label.toUpperCase(), left, doc.y, { width, characterSpacing: 0.4 });
  doc.font("Helvetica").fontSize(10.5).fillColor(PDF_COLORS.ink).text(value, left, doc.y + 1, { width });
  doc.moveDown(0.45);
  doc.fillColor("black");
}

// Structural on purpose (not Prisma's Photo type) so callers with a
// differently-shaped photo record — e.g. RapportTerrainPhoto, which has no
// pointId/blocageId — can reuse this without an unrelated-fields mismatch.
export interface PdfGridPhoto {
  filePath: string;
  takenAt: Date;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
}

function formatPhotoGps(lat?: number | null, lng?: number | null, accuracy?: number | null): string {
  if (lat == null || lng == null) return "GPS indisponible";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}${accuracy != null ? ` (± ${Math.round(accuracy)} m)` : ""}`;
}

// GPS is always attached to the photo itself, never to its point/entry — see
// the same rule enforced in PhotoCapture.tsx (web) — so it's drawn here,
// under each thumbnail, rather than once above the whole grid.
export function drawPhotoGrid(doc: PDFKit.PDFDocument, photos: PdfGridPhoto[]): void {
  if (photos.length === 0) {
    doc.fontSize(9).fillColor(PDF_COLORS.faint).text("Aucune photo pour ce point.");
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
    // A light card frame around every thumbnail — keeps the grid legible
    // even when a photo is missing/unreadable, and reads as one designed
    // component instead of a bare image floating on the page.
    doc.rect(x - 4, rowTop - 4, THUMB + 8, THUMB + 8).fillAndStroke("#fafbfc", PDF_COLORS.rule);
    const absPhotoPath = absolutePathFor(photo.filePath);
    if (fs.existsSync(absPhotoPath)) {
      try {
        doc.image(absPhotoPath, x, rowTop, { fit: [THUMB, THUMB] });
      } catch {
        doc
          .fontSize(8)
          .fillColor(PDF_COLORS.danger)
          .text("Image illisible", x, rowTop + THUMB / 2 - 5, { width: THUMB, align: "center" });
      }
    } else {
      doc.fontSize(8).fillColor(PDF_COLORS.faint).text("Photo indisponible", x, rowTop + THUMB / 2 - 5, { width: THUMB, align: "center" });
    }
    doc
      .fontSize(8)
      .fillColor(PDF_COLORS.muted)
      .text(formatDate(photo.takenAt), x, rowTop + THUMB + 6, { width: THUMB, align: "center" });
    doc
      .fontSize(7)
      .fillColor(PDF_COLORS.faint)
      .text(formatPhotoGps(photo.gpsLat, photo.gpsLng, photo.gpsAccuracy), x, rowTop + THUMB + 17, { width: THUMB, align: "center" });
    doc.fillColor("black");
  });

  doc.x = left;
  doc.y = rowTop + CELL_H;
}

const MATERIEL_COLUMNS = [
  { label: "Référence", width: 70 },
  { label: "Désignation", width: 160 },
  { label: "Prévu", width: 60 },
  { label: "Utilisé", width: 60 },
  { label: "Unité", width: 50 },
  { label: "Écart", width: 60 },
];
const MATERIEL_ROW_H = 18;

function formatQuantity(value: number | null): string {
  return value == null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function drawMaterielTable(
  doc: PDFKit.PDFDocument,
  materiels: Array<{ reference: string | null; designation: string; quantitePrevue: number | null; quantiteUtilisee: number | null; unite: string | null }>
): void {
  if (materiels.length === 0) {
    doc.fontSize(9).fillColor(PDF_COLORS.faint).text("Aucun matériel renseigné pour ce chantier.");
    doc.fillColor("black");
    return;
  }

  const left = doc.page.margins.left;
  const tableWidth = MATERIEL_COLUMNS.reduce((sum, col) => sum + col.width, 0);

  function drawRow(values: string[], header = false): void {
    if (doc.y + MATERIEL_ROW_H > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    if (header) doc.rect(left, y - 3, tableWidth, MATERIEL_ROW_H).fill("#f7f9fc");
    let x = left;
    doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(header ? PDF_COLORS.muted : PDF_COLORS.ink);
    MATERIEL_COLUMNS.forEach((col, i) => {
      doc.text(values[i] ?? "", x + 4, y, { width: col.width - 4, ellipsis: true });
      x += col.width;
    });
    doc.font("Helvetica");
    doc.y = y + MATERIEL_ROW_H;
  }

  drawRow(MATERIEL_COLUMNS.map((c) => c.label), true);

  for (const materiel of materiels) {
    // No gap shown when there's nothing to compare against — a missing
    // planned quantity isn't a discrepancy, it's just not tracked.
    const ecart = materiel.quantitePrevue != null && materiel.quantiteUtilisee != null ? materiel.quantiteUtilisee - materiel.quantitePrevue : null;
    drawRow([
      materiel.reference ?? "—",
      materiel.designation,
      formatQuantity(materiel.quantitePrevue),
      formatQuantity(materiel.quantiteUtilisee),
      materiel.unite ?? "—",
      ecart == null ? "—" : `${ecart > 0 ? "+" : ""}${formatQuantity(ecart)}`,
    ]);
  }
  doc.moveTo(left, doc.y).lineTo(left + tableWidth, doc.y).strokeColor(PDF_COLORS.rule).stroke();
  doc.moveDown(0.6);
  doc.fillColor("black");
}

function drawPlanBlocageOverview(doc: PDFKit.PDFDocument, plan: { filePath: string; fileType: string; points: Array<{ blocages: Array<{ startX: number | null; startY: number | null; endX: number | null; endY: number | null; distanceMeters: number | null; statut: string }> }> }): void {
  const blocages = plan.points.flatMap((point) => point.blocages).filter((blocage) => blocage.startX != null && blocage.startY != null && blocage.endX != null && blocage.endY != null);
  if (blocages.length === 0) return;
  const x = doc.page.margins.left; const y = doc.y; const width = doc.page.width - doc.page.margins.left - doc.page.margins.right; const height = 280;
  const planPath = absolutePathFor(plan.filePath);
  if (["PNG", "JPG"].includes(plan.fileType) && fs.existsSync(planPath)) {
    try { doc.image(planPath, x, y, { fit: [width, height], align: "center", valign: "center" }); } catch { doc.rect(x, y, width, height).fillAndStroke("#f5f5f5", "#b8c1cc"); }
  } else doc.rect(x, y, width, height).fillAndStroke("#f5f5f5", "#b8c1cc");
  for (const blocage of blocages) {
    const ax = x + blocage.startX! * width; const ay = y + blocage.startY! * height; const bx = x + blocage.endX! * width; const by = y + blocage.endY! * height;
    const color = blocage.statut === "OUVERT" ? "#c92f27" : "#718096";
    doc.save().lineWidth(2).strokeColor(color).moveTo(ax, ay).lineTo(bx, by).stroke().circle(ax, ay, 5).fillAndStroke("#ffffff", color).lineWidth(3).moveTo(bx - 7, by - 7).lineTo(bx + 7, by + 7).moveTo(bx + 7, by - 7).lineTo(bx - 7, by + 7).stroke();
    if (blocage.distanceMeters != null) doc.fontSize(8).fillColor(color).text(`${blocage.distanceMeters.toFixed(1)} m`, (ax + bx) / 2 - 24, (ay + by) / 2 - 12, { width: 48, align: "center" });
    doc.restore();
  }
  doc.fillColor("black"); doc.y = y + height + 16;
}

// Shared masthead — logo, name, address, contact — drawn identically at the
// top of every generated PDF (chantier reports and field reports alike).
export async function drawOrganizationHeader(doc: PDFKit.PDFDocument, organization: { logoPath: string | null; name: string; address: string | null; postalCode: string | null; city: string | null; country: string | null; phone: string | null; contactEmail: string | null }): Promise<void> {
  if (organization.logoPath) {
    try { const logo = await sharp(absolutePathFor(organization.logoPath)).resize({ width: 150, height: 70, fit: "inside" }).png().toBuffer(); doc.image(logo, { fit: [150, 70] }); doc.moveDown(0.4); } catch { /* Le rapport reste générable si un ancien logo est illisible. */ }
  }
  doc.font("Helvetica-Bold").fontSize(12).fillColor(PDF_COLORS.ink).text(organization.name);
  doc.font("Helvetica");
  const organizationAddress = [organization.address, [organization.postalCode, organization.city].filter(Boolean).join(" "), organization.country].filter(Boolean).join(" · ");
  if (organizationAddress) doc.fontSize(9).fillColor(PDF_COLORS.muted).text(organizationAddress);
  if (organization.phone || organization.contactEmail) doc.fontSize(9).fillColor(PDF_COLORS.muted).text([organization.phone, organization.contactEmail].filter(Boolean).join(" · "));
  doc.fillColor("black");
  doc.moveDown(0.6);
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(1.5).strokeColor(PDF_COLORS.accent).stroke();
  doc.moveDown(0.8);
}

// Draws "Page X / Y" + the organization name at the bottom of every page —
// has to run after all content is added (page count isn't known until
// then), looping back over PDFKit's buffered pages. Call this right before
// doc.end().
export function drawFooters(doc: PDFKit.PDFDocument, organizationName: string): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    // The footer sits inside the bottom margin on purpose — but pdfkit's
    // .text() treats anything past page.height - margins.bottom as
    // overflow and silently starts a *new* page to fit it, even with an
    // explicit y. Zeroing the margin for this one write stops that (this
    // is pdfkit's own documented workaround for footers), restored right after.
    doc.page.margins.bottom = 0;
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const y = doc.page.height - bottomMargin + 18;
    doc.font("Helvetica").fontSize(8).fillColor(PDF_COLORS.faint);
    doc.text(organizationName, left, y, { width: width / 2, align: "left", lineBreak: false });
    doc.text(`Page ${i - range.start + 1} / ${range.count}`, left, y, { width, align: "right", lineBreak: false });
    doc.fillColor("black");
    doc.page.margins.bottom = bottomMargin;
  }
}

export async function generateChantierReport(chantierId: string, generatedById: string) {
  const chantier = await prisma.chantier.findUnique({
    where: { id: chantierId },
    include: {
      organization: true,
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
      materiels: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!chantier) throw new HttpError(404, "Chantier introuvable");

  const dir = ensureUploadSubdir("reports");
  const fileName = `${crypto.randomUUID()}.pdf`;
  const absPath = path.join(dir, fileName);

  const doc = new PDFDocument({ margin: 50, bufferPages: true });
  const stream = fs.createWriteStream(absPath);
  doc.pipe(stream);

  await drawOrganizationHeader(doc, chantier.organization);
  doc.font("Helvetica-Bold").fontSize(21).fillColor(PDF_COLORS.ink).text(chantier.name);
  doc.font("Helvetica").fillColor(PDF_COLORS.muted).fontSize(9).text(`Rapport généré le ${formatDate(new Date())}`);
  doc.moveDown(0.5);
  if (chantier.address) doc.fontSize(10.5).fillColor(PDF_COLORS.ink).text(chantier.address);
  if (chantier.description) doc.fontSize(10.5).fillColor(PDF_COLORS.ink).text(chantier.description);
  doc.fillColor("black");
  doc.moveDown();

  const allBlocages = chantier.plans.flatMap((plan) => plan.points.flatMap((point) => point.blocages.map((blocage) => ({ ...blocage, pointIdentifiant: point.identifiant }))));
  drawSectionTitle(doc, "Blocages / anomalies");
  if (allBlocages.length === 0) {
    doc.fontSize(9).fillColor(PDF_COLORS.faint).text("Aucun blocage signalé sur ce chantier.");
    doc.fillColor("black");
  } else {
    for (const blocage of allBlocages) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(PDF_COLORS.ink).text(`${blocage.pointIdentifiant} · ${blocage.titre}`);
      doc.font("Helvetica").fontSize(8).fillColor(PDF_COLORS.muted).text(`${blocage.statut} · Priorité ${blocage.priorite} · ${formatDate(blocage.createdAt)}`);
      doc.fontSize(9).fillColor(PDF_COLORS.ink).text(blocage.description);
      doc.moveDown(0.4);
    }
  }

  doc.moveDown(0.5);
  drawSectionTitle(doc, "Matériel");
  drawMaterielTable(doc, chantier.materiels);

  for (const plan of chantier.plans) {
    doc.addPage();
    drawSectionTitle(doc, `Plan : ${plan.fileName}`, { size: 15 });
    drawPlanBlocageOverview(doc, plan);

    if (plan.points.length === 0) {
      doc.fontSize(11).fillColor(PDF_COLORS.faint).text("Aucun point sur ce plan.");
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
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(PDF_COLORS.ink)
        .text(`${point.type ? `[${point.type}] ` : ""}${point.identifiant}${point.nom ? ` — ${point.nom}` : ""}`);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(PDF_COLORS.muted)
        .text(`Statut : ${point.statut}    ·    Ajouté le ${formatDate(point.createdAt)}`);
      if (point.commentaire) {
        doc.fontSize(10).fillColor(PDF_COLORS.ink).text(`Commentaire : ${point.commentaire}`);
      }
      if (point.blocages.length > 0) {
        doc.moveDown(0.5);
        doc.font("Helvetica-Bold").fontSize(11).fillColor(PDF_COLORS.danger).text("Blocages / anomalies");
        doc.font("Helvetica");
        for (const blocage of point.blocages) {
          doc.fontSize(10).fillColor(PDF_COLORS.ink).text(`${blocage.titre} · ${blocage.statut} · Priorité ${blocage.priorite}`);
          doc.fontSize(9).text(`${blocage.description} · Signalé le ${formatDate(blocage.createdAt)}`);
          const startPhotos = blocage.photos.filter((photo) => photo.blocageRole === "DEPART");
          const blockagePhotos = blocage.photos.filter((photo) => photo.blocageRole !== "DEPART");
          if (blocage.distanceMeters != null) doc.fontSize(9).fillColor(PDF_COLORS.danger).text(`Distance GPS A → B : ${blocage.distanceMeters.toFixed(1)} m`);
          if (startPhotos.length > 0) { doc.fontSize(8).fillColor(PDF_COLORS.muted).text("Photos du départ A :"); drawPhotoGrid(doc, startPhotos); }
          if (blockagePhotos.length > 0) { doc.fontSize(8).fillColor(PDF_COLORS.muted).text("Photos du point bloquant B :"); drawPhotoGrid(doc, blockagePhotos); }
        }
      }
      doc.fillColor("black");
      doc.moveDown(0.5);

      drawPhotoGrid(doc, point.photos);
    }
  }

  drawFooters(doc, chantier.organization.name);
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

  logActivityAsync({ organizationId: chantier.organizationId, chantierId: chantier.id, userId: generatedById, action: "RAPPORT_GENERE", metadata: { reportId: report.id } });

  return report;
}
