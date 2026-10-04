import { describe, expect, it } from "vitest";
import { chooseReportSource, classifyHistoricalMatrixValue, parseHistoricalAmount } from "@/server/reports/historical";

describe("separación de fuente histórica y operación", () => {
  it("abre el histórico para administración cuando existe staging", () => {
    expect(chooseReportSource({ canReadHistory: true, hasHistory: true })).toBe("historical");
    expect(chooseReportSource({ requested: "historical", canReadHistory: true, hasHistory: true })).toBe("historical");
  });

  it("respeta operación explícita y no expone el histórico sin rol", () => {
    expect(chooseReportSource({ requested: "operation", canReadHistory: true, hasHistory: true })).toBe("operation");
    expect(chooseReportSource({ requested: "historical", canReadHistory: false, hasHistory: true })).toBe("operation");
    expect(chooseReportSource({ requested: "historical", canReadHistory: true, hasHistory: false })).toBe("operation");
  });
});

describe("lectura conservadora de importes y marcas", () => {
  it("convierte únicamente cantidades numéricas documentadas a centavos", () => {
    expect(parseHistoricalAmount({ literalValue: "28", cachedValue: null, displayValue: "28" })).toBe(2800);
    expect(parseHistoricalAmount({ literalValue: "5,25", cachedValue: null, displayValue: "5,25" })).toBe(525);
    expect(parseHistoricalAmount({ literalValue: null, cachedValue: "10.50", displayValue: "10,50" })).toBe(1050);
    expect(parseHistoricalAmount({ literalValue: "X", cachedValue: null, displayValue: "X" })).toBeNull();
    expect(parseHistoricalAmount(undefined)).toBeNull();
  });

  it("mantiene X, vacío y texto como estados distintos de un importe", () => {
    expect(classifyHistoricalMatrixValue("5", 500)).toBe("AMOUNT");
    expect(classifyHistoricalMatrixValue("X", null)).toBe("MARK");
    expect(classifyHistoricalMatrixValue("", null)).toBe("UNSPECIFIED");
    expect(classifyHistoricalMatrixValue("revisar", null)).toBe("REVIEW");
  });
});
