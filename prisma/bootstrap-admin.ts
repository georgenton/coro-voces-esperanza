import "dotenv/config";
import readline from "node:readline";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { prisma } from "../src/lib/db";
import { createInitialAdmin, inspectInitialAdmin } from "../src/server/auth/initial-admin";
import { describeInitialAdminConflict } from "../src/server/auth/initial-admin-policy";

type Keypress = { ctrl?: boolean; meta?: boolean; name?: string };

async function readSecret(prompt: string) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("El bootstrap requiere una consola interactiva privada.");
  }
  stdout.write(prompt);
  readline.emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise<string>((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      stdin.removeListener("keypress", onKeypress);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdout.write("\n");
    };
    const onKeypress = (text: string, key: Keypress) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Bootstrap cancelado sin crear ni modificar cuentas."));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(value);
        return;
      }
      if (key.name === "backspace") {
        value = value.slice(0, -1);
        return;
      }
      if (!key.ctrl && !key.meta && text) value += text;
    };
    stdin.on("keypress", onKeypress);
  });
}

async function main() {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error("El bootstrap requiere una consola interactiva privada.");
  const questions = createInterface({ input: stdin, output: stdout });
  const name = (await questions.question("Nombre aprobado: ")).trim();
  const email = (await questions.question("Correo aprobado: ")).trim().toLowerCase();
  questions.close();
  if (!name || !email) throw new Error("Nombre y correo son obligatorios.");

  const state = await inspectInitialAdmin(email);
  if (state.kind === "ACTIVE") {
    console.log("La cuenta aprobada ya está activa como SUPERADMIN. No se cambió su contraseña ni sus sesiones.");
    return;
  }
  const conflict = describeInitialAdminConflict(state);
  if (conflict) throw new Error(conflict);

  const password = await readSecret("Contraseña (12 a 128 caracteres, no se mostrará): ");
  const confirmation = await readSecret("Repite la contraseña: ");
  if (password !== confirmation) throw new Error("Las contraseñas no coinciden. No se creó la cuenta.");

  const result = await createInitialAdmin({ email, name, password });
  console.log(result.created
    ? "Cuenta SUPERADMIN inicial creada. Ya puedes iniciar sesión."
    : "La cuenta aprobada ya estaba activa. No se cambió su contraseña ni sus sesiones.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "No se pudo completar el bootstrap.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
