import { readFileSync, writeFileSync } from "fs";

const rows = JSON.parse(readFileSync("scripts/validades-import.json", "utf8"));

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const cols = [
  "promotor",
  "lojas",
  "uf",
  "industria",
  "codigo",
  "descricao",
  "preco",
  "qtde_unit",
  "lote",
  "data_vencimento",
];

const values = rows.map((r) => {
  const parts = cols.map((c) => {
    if (c === "data_vencimento") {
      return r[c] == null ? "NULL" : `'${r[c]}'::timestamptz`;
    }
    return esc(r[c]);
  });
  return `(${parts.join(",")})`;
});

const batchSize = 40;
let batches = 0;
for (let i = 0; i < values.length; i += batchSize) {
  const chunk = values.slice(i, i + batchSize);
  const sql =
    `INSERT INTO public.validades (${cols.join(",")}) VALUES\n` +
    chunk.join(",\n") +
    ";";
  writeFileSync(`scripts/validades-batch-${batches}.sql`, sql, "utf8");
  batches += 1;
}

console.log(`batches=${batches} rows=${rows.length}`);
