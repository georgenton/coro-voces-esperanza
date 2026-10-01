import { describe, expect, it } from "vitest";
import { createAttendanceToken, verifyAttendanceToken } from "@/server/attendance/tokens";

describe("tokens QR", () => {
  it("C37 valida un token vigente del ensayo", () => {
    const now = new Date("2026-10-01T20:00:00Z");
    const token = createAttendanceToken("ensayo-1", 60, now);
    expect(verifyAttendanceToken(token, new Date(now.getTime() + 20_000)).rehearsalId).toBe("ensayo-1");
  });

  it("C39 rechaza firma alterada y token vencido", () => {
    const now = new Date("2026-10-01T20:00:00Z");
    const token = createAttendanceToken("ensayo-1", 60, now);
    expect(() => verifyAttendanceToken(`${token.slice(0, -1)}x`, now)).toThrow(/Firma/);
    expect(() => verifyAttendanceToken(token, new Date(now.getTime() + 90_000))).toThrow(/venció/);
  });
});
