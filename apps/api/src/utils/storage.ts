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
