import { expect, test, type Page } from "@playwright/test";

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
    for (let index = 0; index < 8; index += 1) await page.getByRole("button", { name: "Siguiente →" }).click();
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
