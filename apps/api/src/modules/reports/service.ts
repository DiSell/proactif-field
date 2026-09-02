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

const THUMB = 150;
const GAP = 12;
const PER_ROW = 3;
const CAPTION_H = 22;
const CELL_H = THUMB + CAPTION_H + GAP;

// Structural on purpose (not Prisma's Photo type) so callers with a
// differently-shaped photo record — e.g. RapportTerrainPhoto, which has no
// pointId/blocageId — can reuse this without an unrelated-fields mismatch.
export interface PdfGridPhoto {
  filePath: string;
  takenAt: Date;
}

export function drawPhotoGrid(doc: PDFKit.PDFDocument, photos: PdfGridPhoto[]): void {
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

const MATERIEL_COLUMNS = [
  { label: "Référence", width: 70 },
  { label: "Désignation", width: 160 },
  { label: "Prévu", width: 60 },
  { label: "Utilisé", width: 60 },
  { label: "Unité", width: 50 },
  { label: "Écart", width: 60 },
];
const MATERIEL_ROW_H = 16;

function formatQuantity(value: number | null): string {
  return value == null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function drawMaterielTable(
  doc: PDFKit.PDFDocument,
  materiels: Array<{ reference: string | null; designation: string; quantitePrevue: number | null; quantiteUtilisee: number | null; unite: string | null }>
): void {
  if (materiels.length === 0) {
    doc.fontSize(9).fillColor("gray").text("Aucun matériel renseigné pour ce chantier.");
    doc.fillColor("black");
    return;
  }

  const left = doc.page.margins.left;
  const tableWidth = MATERIEL_COLUMNS.reduce((sum, col) => sum + col.width, 0);

  function drawRow(values: string[], bold = false): void {
    if (doc.y + MATERIEL_ROW_H > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    let x = left;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(bold ? "black" : "#26364d");
    MATERIEL_COLUMNS.forEach((col, i) => {
      doc.text(values[i] ?? "", x, y, { width: col.width, ellipsis: true });
      x += col.width;
    });
    doc.font("Helvetica");
    doc.y = y + MATERIEL_ROW_H;
  }

  drawRow(MATERIEL_COLUMNS.map((c) => c.label), true);
  doc.moveTo(left, doc.y).lineTo(left + tableWidth, doc.y).strokeColor("#cccccc").stroke();
  doc.y += 2;

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
  doc.fillColor("black"); doc.y = y + height + 12;
}

// Shared masthead — logo, name, address, contact — drawn identically at the
// top of every generated PDF (chantier reports and field reports alike).
export async function drawOrganizationHeader(doc: PDFKit.PDFDocument, organization: { logoPath: string | null; name: string; address: string | null; postalCode: string | null; city: string | null; country: string | null; phone: string | null; contactEmail: string | null }): Promise<void> {
  if (organization.logoPath) {
    try { const logo = await sharp(absolutePathFor(organization.logoPath)).resize({ width: 150, height: 70, fit: "inside" }).png().toBuffer(); doc.image(logo, { fit: [150, 70] }); doc.moveDown(0.5); } catch { /* Le rapport reste générable si un ancien logo est illisible. */ }
  }
  doc.fontSize(13).text(organization.name);
  const organizationAddress = [organization.address, [organization.postalCode, organization.city].filter(Boolean).join(" "), organization.country].filter(Boolean).join(" · ");
  if (organizationAddress) doc.fontSize(9).fillColor("gray").text(organizationAddress);
  if (organization.phone || organization.contactEmail) doc.fontSize(9).fillColor("gray").text([organization.phone, organization.contactEmail].filter(Boolean).join(" · "));
  doc.fillColor("black");
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

  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(absPath);
  doc.pipe(stream);

  await drawOrganizationHeader(doc, chantier.organization);
  doc.moveDown().fillColor("black").fontSize(20).text(chantier.name, { underline: true });
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

  doc.moveDown();
  doc.fontSize(15).text("Matériel", { underline: true });
  doc.moveDown(0.3);
  drawMaterielTable(doc, chantier.materiels);

  for (const plan of chantier.plans) {
    doc.addPage();
    doc.fontSize(16).text(`Plan : ${plan.fileName}`, { underline: true });
    doc.moveDown();
    drawPlanBlocageOverview(doc, plan);

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
          const startPhotos = blocage.photos.filter((photo) => photo.blocageRole === "DEPART");
          const blockagePhotos = blocage.photos.filter((photo) => photo.blocageRole !== "DEPART");
          if (blocage.distanceMeters != null) doc.fontSize(9).fillColor("#9b2c2c").text(`Distance GPS A → B : ${blocage.distanceMeters.toFixed(1)} m`);
          if (startPhotos.length > 0) { doc.fontSize(8).fillColor("gray").text("Photos du départ A :"); drawPhotoGrid(doc, startPhotos); }
          if (blockagePhotos.length > 0) { doc.fontSize(8).fillColor("gray").text("Photos du point bloquant B :"); drawPhotoGrid(doc, blockagePhotos); }
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

  logActivityAsync({ organizationId: chantier.organizationId, chantierId: chantier.id, userId: generatedById, action: "RAPPORT_GENERE", metadata: { reportId: report.id } });

  return report;
}
