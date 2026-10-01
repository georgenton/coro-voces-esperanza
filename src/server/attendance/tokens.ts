import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";

const payloadSchema = z.object({
  rehearsalId: z.string().min(1),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
  slot: z.number().int(),
});

function signature(encoded: string) {
  return createHmac("sha256", getServerEnv().QR_SIGNING_SECRET).update(encoded).digest("base64url");
}

export function createAttendanceToken(rehearsalId: string, ttlSeconds: number, now = new Date()) {
  const epoch = Math.floor(now.getTime() / 1000);
  const slot = Math.floor(epoch / ttlSeconds);
  const payload = Buffer.from(JSON.stringify({
    rehearsalId,
    issuedAt: epoch,
    expiresAt: (slot + 1) * ttlSeconds + 10,
    slot,
  })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyAttendanceToken(token: string, now = new Date()) {
  const [encoded, provided] = token.split(".");
  if (!encoded || !provided) throw new Error("Token QR inválido.");
  const expected = signature(encoded);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error("Firma QR inválida.");
  }
  const payload = payloadSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  const epoch = Math.floor(now.getTime() / 1000);
  if (payload.expiresAt < epoch || payload.issuedAt > epoch + 10) throw new Error("El QR venció.");
  return payload;
}
