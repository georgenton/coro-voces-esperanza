import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getServerEnv } from "@/lib/env";

export type DetectedFileType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "text/csv"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (buffer.subarray(0, 4).toString("binary") === "PK\u0003\u0004") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (!buffer.includes(0) && buffer.subarray(0, 4096).toString("utf8").includes(",")) return "text/csv";
  return null;
}

export async function storePrivateFile(input: {
  bytes: Buffer;
  originalName: string;
  allowedTypes: DetectedFileType[];
}) {
  const env = getServerEnv();
  if (input.bytes.length === 0 || input.bytes.length > env.MAX_UPLOAD_BYTES) {
    throw new Error(`El archivo debe pesar entre 1 byte y ${env.MAX_UPLOAD_BYTES} bytes.`);
  }
  const contentType = detectFileType(input.bytes);
  if (!contentType || !input.allowedTypes.includes(contentType)) {
    throw new Error("Tipo de archivo no permitido o contenido inválido.");
  }
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const extension = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "text/csv": ".csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  }[contentType];
  const storageKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
  const root = path.resolve(env.PRIVATE_UPLOAD_DIR);
  const absolutePath = path.resolve(root, storageKey);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) throw new Error("Ruta privada inválida.");
  await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  await writeFile(absolutePath, input.bytes, { mode: 0o600, flag: "wx" });
  return {
    storageKey,
    sha256,
    contentType,
    sizeBytes: input.bytes.length,
    originalName: path.basename(input.originalName).slice(0, 180),
  };
}

export async function readPrivateFile(storageKey: string) {
  const root = path.resolve(getServerEnv().PRIVATE_UPLOAD_DIR);
  const absolutePath = path.resolve(root, storageKey);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) throw new Error("Ruta privada inválida.");
  return readFile(absolutePath);
}
