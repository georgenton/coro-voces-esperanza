import { expect, test } from "@playwright/test";

test("redirige una pantalla privada al acceso individual", async ({ page }) => {
  await page.goto("/resumen");
  await expect(page).toHaveURL(/\/ingresar/);
  await expect(page.getByRole("heading", { name: "Ingresa a tu cuenta" })).toBeVisible();
});

test("bloquea autorregistro y adjuntos anónimos", async ({ request }) => {
  const signUp = await request.post("/api/auth/sign-up/email", { data: { email: "persona@example.test", password: "no-debe-crearse", name: "Persona" } });
  expect(signUp.status()).toBe(404);
  const attachment = await request.get("/api/attachments/no-existe");
  expect(attachment.status()).toBe(401);
});

test("el formulario de ingreso cabe en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ingresar");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
