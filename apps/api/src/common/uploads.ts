import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const avatarExtensionByMimeType: Record<string, string> = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function resolveUploadRoot() {
  const configured = process.env.UPLOAD_ROOT?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  const fromCwd = path.resolve(process.cwd(), "uploads");
  const fromWorkspace = path.resolve(process.cwd(), "../../uploads");
  if (fs.existsSync(path.resolve(process.cwd(), ".env"))) return fromCwd;
  return fromWorkspace;
}

export function resolveAvatarUploadDir() {
  return path.join(resolveUploadRoot(), "avatars");
}

export function ensureUploadRootExists() {
  fs.mkdirSync(resolveUploadRoot(), { recursive: true });
}

export function ensureAvatarUploadDirExists() {
  fs.mkdirSync(resolveAvatarUploadDir(), { recursive: true });
}

export function resolveAvatarExtension(mimeType: string) {
  return avatarExtensionByMimeType[mimeType] || ".png";
}

export function createUploadFilename(extension: string) {
  return `${randomUUID()}${extension}`;
}
