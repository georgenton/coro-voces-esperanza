import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const PASSWORD = "Voces-E2E-2026!";

test("verifica 36 combinaciones visuales con datos sintéticos", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "La matriz controla explícitamente sus tres anchos.");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/ingresar");
  await page.getByLabel("Correo personal").fill("tesoreria.e2e@example.test");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/resumen/);

  const updateEvidence = process.env.UPDATE_UI_SCREENSHOTS === "true";
  const output = process.env.VISUAL_OUTPUT_DIR
    ? path.resolve(process.env.VISUAL_OUTPUT_DIR)
    : path.join(process.cwd(), "docs", "evidencia-ui", "regression");
  if (updateEvidence) await mkdir(output, { recursive: true });
  const screens = (["historical", "operation"] as const).flatMap((source) => [
    { name: `dashboard-${source}`, route: `/resumen?period=2026-09&source=${source}`, heading: "Resumen del coro" },
    { name: `movimientos-${source}`, route: `/reportes/movimientos?period=2026-09&source=${source}`, heading: "Reporte mensual" },
    { name: `cuotas-${source}`, route: `/reportes/cuotas?year=2026&cutoff=2026-09&month=9&source=${source}`, heading: "Matriz anual de cuotas" },
  ]);
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((value) => {
      localStorage.setItem("vde:theme:v1", value);
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const screen of screens) {
        consoleErrors.length = 0;
        await page.goto(screen.route);
        await expect(page.getByRole("heading", { name: screen.heading })).toBeVisible();
        await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
        expect(consoleErrors, `Consola en ${screen.route} (${width}px, ${theme})`).toEqual([]);
        const metrics = await page.evaluate(() => {
          const h1 = document.querySelector<HTMLElement>("h1");
          const sidebar = document.querySelector<HTMLElement>(".sidebar");
          const menu = document.querySelector<HTMLElement>(".mobile-menu-trigger");
          const control = document.querySelector<HTMLElement>("button.button, a.button, input:not([type=hidden]), select");
          const kpis = document.querySelector<HTMLElement>(".grid-4");
          const secondary = document.querySelector<HTMLElement>(".button-secondary");
          return {
            h1: h1 ? getComputedStyle(h1).fontSize : null,
            sidebarWidth: sidebar?.getBoundingClientRect().width ?? 0,
            sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : null,
            menuDisplay: menu ? getComputedStyle(menu).display : null,
            controlHeight: control?.getBoundingClientRect().height ?? 0,
            kpiColumns: kpis ? getComputedStyle(kpis).gridTemplateColumns.split(" ").length : 0,
            secondaryBackground: secondary ? getComputedStyle(secondary).backgroundColor : null,
          };
        });
        expect(metrics.h1).toBe("22px");
        expect(metrics.controlHeight).toBeGreaterThanOrEqual(width <= 650 ? 44 : 36);
        expect(metrics.secondaryBackground).not.toBe(theme === "dark" ? "rgb(158, 161, 245)" : "rgb(68, 71, 184)");
        if (width <= 820) {
          expect(metrics.sidebarDisplay).toBe("none");
          expect(metrics.menuDisplay).not.toBe("none");
        } else {
          expect(metrics.sidebarWidth).toBe(232);
          expect(metrics.menuDisplay).toBe("none");
        }
        if (width === 390 && metrics.kpiColumns) expect(metrics.kpiColumns).toBe(2);
        if (screen.name === "movimientos-historical" && theme === "dark") {
          await expect(page.locator(".source-date-header")).toHaveCSS("color", "rgb(233, 209, 138)");
          await expect(page.getByRole("columnheader", { name: "Origen" })).toHaveCount(0);
        }
        if (screen.name === "cuotas-historical") {
          await expect(page.getByText("Pagado", { exact: true })).toHaveCount(0);
          if (width === 390) await expect(page.getByRole("columnheader", { name: "Sep" })).toBeVisible();
        }
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        if (updateEvidence) await page.screenshot({ path: path.join(output, `${screen.name}-${width}-${theme}.png`), fullPage: true, caret: "initial" });
      }
    }
  }
});
