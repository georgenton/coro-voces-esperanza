import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const PASSWORD = "Voces-E2E-2026!";

test("genera evidencia responsive clara y oscura con datos sintéticos", async ({ page }, testInfo) => {
  test.skip(process.env.UPDATE_UI_SCREENSHOTS !== "true" || testInfo.project.name !== "chromium-desktop", "Evidencia visual se actualiza solo por solicitud explícita.");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/ingresar");
  await page.getByLabel("Correo personal").fill("tesoreria.e2e@example.test");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/resumen/);

  const output = path.join(process.cwd(), "docs", "evidencia-ui");
  await mkdir(output, { recursive: true });
  const screens = [
    { name: "dashboard", route: "/resumen?period=2026-09&source=operation", heading: "Resumen del coro" },
    { name: "movimientos", route: "/reportes/movimientos?period=2026-09&source=operation", heading: "Reporte mensual" },
    { name: "cuotas", route: "/reportes/cuotas?year=2026&cutoff=2026-09&source=operation", heading: "Matriz anual de cuotas" },
  ];
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((value) => {
      localStorage.setItem("vde:theme:v1", value);
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const screen of screens) {
        await page.goto(screen.route);
        await expect(page.getByRole("heading", { name: screen.heading })).toBeVisible();
        await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
        expect(consoleErrors, `Consola en ${screen.route} (${width}px, ${theme})`).toEqual([]);
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await page.screenshot({ path: path.join(output, `${screen.name}-${width}-${theme}.png`), fullPage: true });
      }
    }
  }
});
