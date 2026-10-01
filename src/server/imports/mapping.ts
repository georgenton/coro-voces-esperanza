import { createHash } from "node:crypto";
import { z } from "zod";
import { normalizeName } from "@/lib/names";

const id = z.string().trim().min(1);
const cents = z.number().int().positive().max(100_000_000);
const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const importTransformationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("MEMBER_CREATE"),
    displayName: z.string().trim().min(2).max(120),
    originalName: z.string().trim().min(1).max(200).optional(),
    sectionId: id,
    startsOn: civilDate,
    status: z.enum(["ACTIVE", "PAUSED", "RETIRED"]),
  }),
  z.object({
    type: z.literal("IDENTITY_LINK"),
    memberId: id,
    sourceName: z.string().trim().min(1).max(200),
  }),
  z.object({
    type: z.literal("SECTION_ASSIGNMENT"),
    memberId: id,
    sectionId: id,
    startsOn: civilDate,
    endsOn: civilDate.nullable().optional(),
  }),
  z.object({
    type: z.literal("CHARGE"),
    memberId: id,
    conceptId: id,
    period,
    amountCents: cents,
    dueOn: civilDate.nullable().optional(),
  }),
  z.object({
    type: z.literal("LEGACY_ALLOCATION"),
    memberId: id,
    conceptId: id,
    period,
    chargeAmountCents: cents,
    appliedAmountCents: cents,
    dueOn: civilDate.nullable().optional(),
    appliedOn: civilDate.nullable().optional(),
  }),
  z.object({
    type: z.literal("MONEY_MOVEMENT"),
    accountId: id,
    movementType: z.enum(["PAYMENT", "EXPENSE", "INTEREST"]),
    direction: z.enum(["IN", "OUT"]),
    amountCents: cents,
    occurredOn: civilDate,
    externalReference: z.string().trim().max(160).optional(),
    description: z.string().trim().max(300).optional(),
  }),
  z.object({
    type: z.literal("OPENING_BALANCE"),
    accountId: id,
    amountCents: cents,
    direction: z.enum(["IN", "OUT"]),
    cutoffOn: civilDate,
    description: z.string().trim().min(3).max(300),
  }),
]);

export type ImportTransformation = z.infer<typeof importTransformationSchema>;
export type ImportTransformationType = ImportTransformation["type"];
export type PromotionScope = "ALL_APPROVED" | "MEMBERS" | "FINANCE";

const memberTypes = new Set<ImportTransformationType>([
  "MEMBER_CREATE",
  "IDENTITY_LINK",
  "SECTION_ASSIGNMENT",
]);

export function transformationInScope(transformation: ImportTransformation, scope: PromotionScope) {
  if (scope === "ALL_APPROVED") return true;
  return scope === "MEMBERS" ? memberTypes.has(transformation.type) : !memberTypes.has(transformation.type);
}

export function parseImportTransformation(value: unknown): ImportTransformation {
  const result = importTransformationSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Mapeo incompleto: ${result.error.issues.map(({ path, message }) => `${path.join(".")}: ${message}`).join("; ")}`);
  }
  return result.data;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashTransformation(type: string | null, transformed: unknown) {
  return createHash("sha256").update(canonical({ type, transformed })).digest("hex");
}

export function hashApprovedMapping(rows: Array<{
  id: string;
  recordFingerprint: string;
  status: string;
  proposedType: string | null;
  transformed: unknown;
}>) {
  const stable = rows
    .map((row) => ({
      id: row.id,
      recordFingerprint: row.recordFingerprint,
      status: row.status,
      proposedType: row.proposedType,
      transformed: row.transformed,
    }))
    .toSorted((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256").update(canonical(stable)).digest("hex");
}

export function importSourceKey(batchSha256: string, rowId: string, target: string) {
  return `import:${batchSha256}:${rowId}:${target}`;
}

export function dateAtGuayaquilMidnight(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00-05:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Fecha civil inválida.");
  return parsed;
}

export type IdentitySuggestion = {
  memberId: string;
  displayName: string;
  kind: "EXACT" | "POSSIBLE";
  score: number;
};

export function suggestIdentityMatches(
  sourceName: string,
  members: Array<{ id: string; displayName: string; normalizedName: string }>,
): IdentitySuggestion[] {
  const normalized = normalizeName(sourceName.split("|")[0] ?? sourceName);
  if (!normalized) return [];
  const sourceTokens = new Set(normalized.split(" ").filter((token) => token.length > 1));
  return members
    .map((member) => {
      if (member.normalizedName === normalized) {
        return { memberId: member.id, displayName: member.displayName, kind: "EXACT" as const, score: 1 };
      }
      const candidateTokens = new Set(member.normalizedName.split(" ").filter((token) => token.length > 1));
      const intersection = [...sourceTokens].filter((token) => candidateTokens.has(token)).length;
      const union = new Set([...sourceTokens, ...candidateTokens]).size;
      return {
        memberId: member.id,
        displayName: member.displayName,
        kind: "POSSIBLE" as const,
        score: union ? intersection / union : 0,
      };
    })
    .filter(({ score, kind }) => kind === "EXACT" || score >= 0.45)
    .toSorted((left, right) => right.score - left.score || left.displayName.localeCompare(right.displayName))
    .slice(0, 4);
}
