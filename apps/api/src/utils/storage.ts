import fs from "fs";
import path from "path";
import { env } from "../config/env";

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);

export function ensureUploadSubdir(subdir: string): string {
  const dir = path.join(uploadRoot, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function absolutePathFor(relativePath: string): string {
  return path.join(uploadRoot, relativePath);
}

export function deleteFile(relativePath: string): void {
  const abs = absolutePathFor(relativePath);
  fs.rm(abs, { force: true }, () => undefined);
}

// multer/busboy decode the filename= parameter of a multipart
// Content-Disposition header as latin1 by convention (a historical
// multipart quirk), even though every modern browser sends that header
// UTF-8-encoded. Left uncorrected, an accented original filename comes
// back as mojibake (e.g. "Plan de prÃ©vention.txt" instead of
// "Plan de prévention.txt"). Re-decoding those bytes as UTF-8 fixes it;
// call this on req.file.originalname before persisting it anywhere.
export function decodeOriginalFilename(name: string): string {
  return Buffer.from(name, "latin1").toString("utf8");
}
