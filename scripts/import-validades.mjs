import XLSX from "xlsx";
import { writeFileSync } from "fs";
import { resolve } from "path";

const XLSX_PATH = "c:\\Users\\helry\\OneDrive\\Desktop\\validades.xlsx";
const OUT_PATH = resolve("scripts", "validades-import.json");

function parsePreco(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  const cleaned = String(value)
    .replace(/R\$\s?/gi, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDataVencimento(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  // M/D/YY or M/D/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, month, day, year] = m;
    let y = Number(year);
    if (y < 100) y += 2000;
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

function cleanText(value) {
  if (value == null) return null;
  return String(value).replace(/\r\n/g, " ").replace(/\n/g, " ").trim() || null;
}

const wb = XLSX.readFile(XLSX_PATH);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });

const mapped = rows.map((row) => ({
  promotor: cleanText(row["PROMOTOR"]),
  lojas: cleanText(row["LOJAS"]),
  uf: cleanText(row["UF"]),
  industria: cleanText(row["INDUSTRIA"]),
  codigo: cleanText(row["CODIGO"] != null ? String(row["CODIGO"]) : null),
  descricao: cleanText(row["DESCRIÇÃO"] ?? row["DESCRICAO"]),
  preco: parsePreco(row["PREÇO"] ?? row["PRECO"]),
  qtde_unit:
    row["QTDE UNIT"] == null || row["QTDE UNIT"] === ""
      ? null
      : Number(row["QTDE UNIT"]),
  lote: cleanText(row["LOTE"] != null ? String(row["LOTE"]) : null),
  data_vencimento: parseDataVencimento(row["DATA-VENCIMENTO"]),
}));

writeFileSync(OUT_PATH, JSON.stringify(mapped, null, 2), "utf8");
console.log(`rows=${mapped.length}`);
console.log("sample=", JSON.stringify(mapped[0], null, 2));
console.log("last=", JSON.stringify(mapped[mapped.length - 1], null, 2));
console.log(`wrote ${OUT_PATH}`);
