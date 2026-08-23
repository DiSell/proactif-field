import multer from "multer";
import path from "path";
import crypto from "crypto";
import { ensureUploadSubdir } from "../utils/storage";

function makeUploader(subdir: string, allowedExtensions: string[], maxSize = 25 * 1024 * 1024, allowedMimeTypes?: string[]) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, ensureUploadSubdir(subdir));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${crypto.randomUUID()}${ext}`;
      cb(null, name);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        cb(new Error(`Extension de fichier non autorisée: ${ext}`));
        return;
      }
      if (allowedMimeTypes && !allowedMimeTypes.includes(file.mimetype)) {
        cb(new Error("Type MIME non autorisé"));
        return;
      }
      cb(null, true);
    },
  });
}

export const uploadPlan = makeUploader("plans", [".pdf", ".png", ".jpg", ".jpeg", ".svg"]);
export const uploadPhoto = makeUploader("photos", [".png", ".jpg", ".jpeg", ".webp", ".heic"]);
export const uploadOrganizationLogo = makeUploader("organization-logos", [".png", ".jpg", ".jpeg", ".webp"], 2 * 1024 * 1024, ["image/png", "image/jpeg", "image/webp"]);
export const uploadDocument = makeUploader("documents", [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
]);
