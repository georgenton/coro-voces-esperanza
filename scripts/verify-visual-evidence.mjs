import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("docs/evidencia-ui/revision-08");
const screens = ["dashboard", "movimientos", "cuotas"];
const widths = [390, 1024, 1440];
const themes = ["light", "dark"];
const sources = ["historical", "operation"];

function names({ includeSource }) {
  const values = [];
  for (const screen of screens) for (const source of includeSource ? sources : [null]) for (const width of widths) for (const theme of themes) {
    values.push(`${screen}${source ? `-${source}` : ""}-${width}-${theme}.png`);
  }
  return values.sort();
}

async function verifyDirectory(relative, expected) {
  const directory = path.join(root, relative);
  const actual = (await readdir(directory)).filter((file) => file.endsWith(".png")).sort();
  assert.deepEqual(actual, expected, `${relative}: nombres o cantidad de capturas inesperados`);
  const hashes = new Set();
  for (const file of actual) {
    const bytes = await readFile(path.join(directory, file));
    assert.equal(bytes.subarray(1, 4).toString(), "PNG", `${relative}/${file}: no es PNG`);
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const expectedWidth = Number(file.match(/-(390|1024|1440)-/)?.[1]);
    assert.ok(Math.abs(width - expectedWidth) <= 1, `${relative}/${file}: ancho incorrecto`);
    assert.ok(height >= (width === 390 ? 844 : 1000), `${relative}/${file}: captura incompleta`);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size, actual.length, `${relative}: existen capturas duplicadas`);
  return actual.length;
}

const summary = {
  reference: await verifyDirectory("referencia", names({ includeSource: false })),
  beforeHistorical: await verifyDirectory("antes-historico", names({ includeSource: true }).filter((name) => name.includes("-historical-"))),
  after: await verifyDirectory("despues", names({ includeSource: true })),
};

const comparison = await readFile(path.join(root, "comparacion-representativa.png"));
assert.equal(comparison.readUInt32BE(16), 1600, "El panel comparativo debe conservar 1600 px de ancho");
console.log(JSON.stringify(summary));
