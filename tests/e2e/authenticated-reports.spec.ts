import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";

const PASSWORD = "Voces-E2E-2026!";
const USERS = {
  admin: "tesoreria.e2e@example.test",
  head: "jefatura.e2e@example.test",
  member: "miembro.e2e@example.test",
} as const;

async function signIn(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByLabel("Correo personal").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/resumen/);
}

async function downloadText(download: Download) {
  const file = await download.path();
  if (!file) throw new Error("La descarga no produjo un archivo local.");
  return readFile(file, "utf8");
}

test("tesorería consulta el dashboard y conserva el período al navegar", async ({ page }) => {
  await signIn(page, USERS.admin);
  await page.goto("/resumen?period=2026-09&source=operation");
  await expect(page.getByRole("heading", { name: "Resumen del coro" })).toBeVisible();
  await expect(page.getByText("Tendencia de seis meses")).toBeVisible();
  const monthlyLink = page.getByRole("link", { name: "Abrir 2026-09" });
  await expect(monthlyLink).toHaveAttribute("href", "/reportes/movimientos?period=2026-09&source=operation");
  await monthlyLink.click();
  await expect(page).toHaveURL(/\/reportes\/movimientos\?period=2026-09/);
  await expect(page.getByText("Pago coral sintético")).toBeVisible();
});

test("reporte mensual filtra, exporta y abre un detalle accesible", async ({ page }) => {
  await signIn(page, USERS.admin);
  await page.goto("/reportes/movimientos?period=2026-09&source=operation");
  const paymentRow = page.locator("tbody tr").filter({ hasText: "Pago coral sintético" });
  await expect(paymentRow).toBeVisible();
  await paymentRow.focus();
  await paymentRow.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Pago coral sintético" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Alba Sintética")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cerrar detalle" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Cerrar detalle" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(paymentRow).toBeFocused();

  await page.getByLabel("Tipo").selectOption("EXPENSE");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/type=EXPENSE/);
  await expect(page.getByText("Partituras sintéticas")).toBeVisible();
  await expect(page.getByText("Pago coral sintético")).not.toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("movimientos-2026-09.csv");
});

test("matriz anual filtra y expone el cargo sin confundir ausencia con pago", async ({ page }) => {
  await signIn(page, USERS.admin);
  await page.goto("/reportes/cuotas?year=2026&cutoff=2026-09&source=operation");
  await page.getByLabel("Cuerda").selectOption({ label: "Soprano E2E" });
  await page.getByLabel("Buscar persona").fill("Alba");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/section=/);
  await expect(page.getByText("Alba Sintética").first()).toBeVisible();
  await expect(page.getByText("Bruno Sintético")).not.toBeVisible();

  const mobile = (page.viewportSize()?.width ?? 1000) <= 650;
  if (mobile) {
    await expect(page.getByRole("columnheader", { name: "Sep" })).toBeVisible();
  }
  const september = page.getByLabel(/Alba Sintética, 2026-09:/);
  await september.focus();
  await september.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Alba Sintética" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Cargos que forman la celda")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(september).toBeFocused();

  if (mobile) {
    await page.getByRole("button", { name: "← Anterior" }).click();
    await expect(page.getByRole("columnheader", { name: "Ago" })).toBeVisible();
    const noPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(noPageOverflow).toBe(true);
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar CSV" }).click();
  expect((await downloadPromise).suggestedFilename()).toContain("cuotas-monthly_dues-2026-corte-2026-09.csv");
});

test("fuente histórica conserva significado, procedencia y CSV sin crear operaciones", async ({ page }) => {
  await signIn(page, USERS.admin);
  await page.goto("/reportes/movimientos?period=2026-09&source=historical");
  await expect(page.getByRole("columnheader", { name: "Origen" })).toHaveCount(0);
  const row = page.locator("tbody tr").filter({ hasText: "Aporte coral sintético" });
  await row.locator("td").first().click();
  const rowDialog = page.getByRole("dialog", { name: "Observación breve" });
  await expect(rowDialog.getByText(/Fuente histórica, no operación validada/)).toBeVisible();
  await expect(rowDialog.getByText(/SEPTIEMBRE 2026!/).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(rowDialog).not.toBeVisible();
  const observation = page.locator(".source-observation-cell summary").first();
  await observation.click();
  await expect(page.locator(".source-observation-cell details").first()).toHaveAttribute("open", "");

  const monthlyDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar fuente CSV" }).click();
  const monthlyCsv = await downloadText(await monthlyDownload);
  expect(monthlyCsv).toContain("Aporte coral sintético");
  expect(monthlyCsv).toContain("15.00");
  expect(monthlyCsv).not.toContain("Pago coral sintético");

  await page.goto("/reportes/cuotas?year=2026&cutoff=2026-09&month=9&source=historical");
  await expect(page.getByText("Pagado", { exact: true })).toHaveCount(0);
  const documentedCell = page.getByLabel(/Alba Sintética, 2026-09: Importe documentado/);
  await documentedCell.click();
  const cellDialog = page.getByRole("dialog", { name: "Alba Sintética" });
  await expect(cellDialog.getByText(/Evidencia literal del Excel/)).toBeVisible();
  await expect(cellDialog.getByText(/SOLO CUOTAS 2026!/).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(documentedCell).toBeFocused();

  const duesDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar fuente CSV" }).click();
  const duesCsv = await downloadText(await duesDownload);
  expect(duesCsv).toContain("Alba Sintética");
  expect(duesCsv).toContain("AMOUNT");
  expect(duesCsv).not.toContain("PAID");
});

test("menú móvil es operable con teclado y conserva el foco", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "El cajón solo se presenta a 820 px o menos.");
  await signIn(page, USERS.admin);
  const trigger = page.getByRole("button", { name: "Abrir menú principal" });
  await trigger.focus();
  await trigger.press("Enter");
  const menu = page.getByRole("dialog", { name: "Menú principal" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("link", { name: "Cuotas de miembros" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("el servidor aplica alcance de cuerda y alcance individual", async ({ browser }) => {
  const headContext = await browser.newContext();
  const headPage = await headContext.newPage();
  await signIn(headPage, USERS.head);
  await headPage.goto("/reportes/cuotas?year=2026&cutoff=2026-09&source=operation");
  await expect(headPage.getByText("Alba Sintética").first()).toBeVisible();
  await expect(headPage.getByText("Clara Sintética").first()).toBeVisible();
  await expect(headPage.getByText("Bruno Sintético")).not.toBeVisible();
  await headPage.goto("/reportes/movimientos?period=2026-09&source=operation");
  await expect(headPage).toHaveURL(/\/sin-acceso/);
  await headContext.close();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await signIn(memberPage, USERS.member);
  await memberPage.goto("/reportes/cuotas?year=2026&cutoff=2026-09&source=operation");
  await expect(memberPage.getByText("Alba Sintética").first()).toBeVisible();
  await expect(memberPage.getByText("Clara Sintética")).not.toBeVisible();
  await expect(memberPage.getByText("Bruno Sintético")).not.toBeVisible();
  await memberContext.close();
});
