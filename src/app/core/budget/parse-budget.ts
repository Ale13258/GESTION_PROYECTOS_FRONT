import * as XLSX from 'xlsx';
import { Equipment } from '../models/promanage.models';

export interface BudgetRelatedEquipment {
  id: string;
  name: string;
}

export interface BudgetRow {
  kind: 'banner' | 'section' | 'item' | 'total' | 'other';
  cells: string[];
  amounts: number[];
  relatedEquipment: BudgetRelatedEquipment[];
}

export interface ParsedBudgetSheet {
  name: string;
  sourceName: string;
  columns: string[];
  rows: BudgetRow[];
  total: number;
  totalCol: number;
}

export interface ParsedBudget {
  title: string;
  fileName: string;
  sheets: ParsedBudgetSheet[];
  grandTotal: number;
}

interface SheetCell {
  text: string;
  amount: number;
}

function cellText(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(/\u00a0/g, ' ').trim();
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseMoney(value: string): number {
  const raw = value.replace(/[$\s]/g, '').replace(/–|—/g, '-').trim();
  if (!raw || raw === '-' || raw === '0' || raw === '0,00' || raw === '0.00') return 0;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized = raw.replace(/[^\d,.-]/g, '');
  if (lastComma > lastDot) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    normalized = normalized.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = normalized.replace(',', '.');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatCop(amount: number): string {
  return amount.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isMoneyHeader(header: string): boolean {
  return header.includes('valor unitario') || header.includes('valor total');
}

function readCell(cell: XLSX.CellObject | undefined): SheetCell {
  if (!cell) return { text: '', amount: 0 };
  const text = cellText(cell.w ?? (cell.v == null ? '' : cell.v));
  if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    return { text: text || String(cell.v), amount: cell.v };
  }
  return { text, amount: parseMoney(text) };
}

function sheetBounds(sheet: XLSX.WorkSheet): { r0: number; c0: number; r1: number; c1: number } {
  let r0 = Number.POSITIVE_INFINITY;
  let c0 = Number.POSITIVE_INFINITY;
  let r1 = 0;
  let c1 = 0;
  if (sheet['!ref']) {
    const range = XLSX.utils.decode_range(sheet['!ref']);
    r0 = range.s.r;
    c0 = range.s.c;
    r1 = range.e.r;
    c1 = range.e.c;
  }
  for (const key of Object.keys(sheet)) {
    if (key.startsWith('!')) continue;
    const pos = XLSX.utils.decode_cell(key);
    r0 = Math.min(r0, pos.r);
    c0 = Math.min(c0, pos.c);
    r1 = Math.max(r1, pos.r);
    c1 = Math.max(c1, pos.c);
  }
  if (!Number.isFinite(r0)) return { r0: 0, c0: 0, r1: 0, c1: 0 };
  return { r0, c0, r1, c1 };
}

function matrixFromSheet(sheet: XLSX.WorkSheet): SheetCell[][] {
  const { r0, c0, r1, c1 } = sheetBounds(sheet);
  const rows: SheetCell[][] = [];
  for (let r = r0; r <= r1; r++) {
    const row: SheetCell[] = [];
    for (let c = c0; c <= c1; c++) {
      row.push(readCell(sheet[XLSX.utils.encode_cell({ r, c })]));
    }
    rows.push(row);
  }
  return trimMatrix(rows);
}

function trimMatrix(matrix: SheetCell[][]): SheetCell[][] {
  const usedCols = new Set<number>();
  const rows = matrix.filter((row) => row.some((cell) => cell.text.length > 0));
  for (const row of rows) {
    row.forEach((cell, index) => {
      if (cell.text) usedCols.add(index);
    });
  }
  const cols = [...usedCols].sort((a, b) => a - b);
  return rows.map((row) => cols.map((index) => row[index] ?? { text: '', amount: 0 }));
}

function headerKey(cell: SheetCell): string {
  return normalize(cell.text.replace(/\n/g, ' '));
}

function isHeaderRow(row: SheetCell[]): boolean {
  const joined = headerKey({ text: row.map((c) => c.text).join(' '), amount: 0 });
  return (
    (joined.includes('descripcion') || joined.includes('item de pago') || joined.includes('item de')) &&
    (joined.includes('cantidad') || joined.includes('valor'))
  );
}

function columnLabels(row: SheetCell[]): string[] {
  return row.map((cell, index) => cell.text.replace(/\s+/g, ' ').trim() || `Col ${index + 1}`);
}

function findCol(header: string[], ...exact: string[]): number {
  for (const name of exact) {
    const i = header.findIndex((h) => h === name);
    if (i >= 0) return i;
  }
  return -1;
}

function findValorTotalCol(header: string[]): number {
  const exact = findCol(header, 'valor total');
  if (exact >= 0) return exact;
  return header.findIndex((h) => h.includes('valor') && h.includes('total') && !h.includes('unitario'));
}

function isTotalRow(row: SheetCell[]): boolean {
  return row.some((cell) => normalize(cell.text.replace(/\s+/g, ' ')) === 'total');
}

function isDashAmount(text: string): boolean {
  const t = text.replace(/[$\s]/g, '').replace(/–|—/g, '-');
  return !t || t === '-' || t === '0' || t === '0,00' || t === '0.00';
}

function classifyRow(row: SheetCell[], qtyCol: number, unitCol: number, totalCol: number, descCol: number): BudgetRow['kind'] {
  if (isTotalRow(row)) return 'total';
  const desc = cellText(descCol >= 0 ? row[descCol].text : '');
  const heading = desc || row.find((cell) => cell.text.length > 3)?.text || '';
  const n = normalize(heading);
  const totalText = totalCol >= 0 ? row[totalCol].text : '';
  const totalAmt = totalCol >= 0 ? row[totalCol].amount : 0;
  const qtyText = qtyCol >= 0 ? row[qtyCol].text : '';
  const unitText = unitCol >= 0 ? row[unitCol].text : '';
  const hasQty = /\d/.test(qtyText);
  const hasUnit = /^(und|unid|gl|global)\b/i.test(unitText.trim());
  const hasMoney = totalAmt > 0 && !isDashAmount(totalText);

  if (n.includes('propuesta economica') || n === 'obra civil') return 'banner';
  if (n.includes('cantidad de obra') || (n.includes('presupuesto') && !hasMoney && !hasQty)) return 'banner';
  if (!hasMoney && !hasQty && !hasUnit) return 'section';
  if (hasMoney && (hasQty || hasUnit || /instalacion|suministro|montaje|diseno|ingenieria/i.test(heading))) {
    return 'item';
  }
  return hasMoney ? 'item' : 'section';
}

function relatedEquipment(text: string, equipment: Equipment[]): BudgetRelatedEquipment[] {
  const haystack = normalize(text);
  if (!haystack) return [];
  return equipment
    .filter((item) => {
      const keys = [item.name, item.proceso, item.category].map(normalize).filter((k) => k.length > 3);
      return keys.some(
        (key) =>
          haystack.includes(key) ||
          key.split(' ').some((w) => w.length > 5 && haystack.includes(w)) ||
          haystack.split(' ').some((w) => w.length > 5 && key.includes(w)),
      );
    })
    .slice(0, 3)
    .map((item) => ({ id: item.id, name: item.name }));
}

function sheetTotal(rows: BudgetRow[], totalCol: number): number {
  const labeled = rows.find((row) => row.kind === 'total');
  const labeledAmount = labeled ? labeled.amounts[totalCol] || Math.max(0, ...labeled.amounts) : 0;
  const summed = rows.reduce((sum, row) => {
    if (row.kind === 'total' || row.kind === 'banner') return sum;
    const amount = row.amounts[totalCol] ?? 0;
    return amount > 0 ? sum + amount : sum;
  }, 0);
  return labeledAmount > 0 ? labeledAmount : summed;
}

function parseSheet(name: string, sheet: XLSX.WorkSheet, equipment: Equipment[]): ParsedBudgetSheet | null {
  const matrix = matrixFromSheet(sheet);
  if (!matrix.length) return null;

  const headerIndex = matrix.findIndex(isHeaderRow);
  const fallback = headerIndex >= 0 ? headerIndex : 0;
  const header = (matrix[fallback] ?? []).map(headerKey);
  const columns = columnLabels(matrix[fallback] ?? matrix[0]);
  const descCol = header.findIndex((h) => h.includes('descripcion'));
  const qtyCol = findCol(header, 'cantidad');
  const unitCol = findCol(header, 'und', 'und.', 'unidad');
  const totalCol = findValorTotalCol(header);
  const amountCol = totalCol >= 0 ? totalCol : columns.length - 1;

  let start = headerIndex >= 0 ? headerIndex + 1 : 0;
  if (start < matrix.length && normalize(matrix[start].map((c) => c.text).join(' ')) === 'pago') {
    start += 1;
  }

  const dataRows = [...matrix.slice(0, headerIndex >= 0 ? headerIndex : 0), ...matrix.slice(start)];
  const rows: BudgetRow[] = dataRows
    .filter((row) => row.some((cell) => cell.text.length > 0))
    .map((row) => {
      const cells = columns.map((_, index) => {
        const cell = row[index] ?? { text: '', amount: 0 };
        if (isMoneyHeader(header[index] ?? '')) {
          if (cell.amount > 0) return formatCop(cell.amount);
          return cell.text ? '$ -' : '';
        }
        return cell.text.replace(/\r\n/g, ' ');
      });
      const amounts = columns.map((_, index) => row[index]?.amount ?? 0);
      const kind = classifyRow(row, qtyCol, unitCol, amountCol, descCol);
      return {
        kind,
        cells,
        amounts,
        relatedEquipment: kind === 'item' ? relatedEquipment(cells.join(' '), equipment) : [],
      };
    });

  const titleCell =
    matrix
      .find((row) => normalize(row.map((c) => c.text).join(' ')).includes('propuesta economica'))
      ?.find((cell) => cell.text)?.text ||
    matrix
      .find((row) => normalize(row.map((c) => c.text).join(' ')) === 'obra civil')
      ?.find((cell) => cell.text)?.text ||
    name;

  return {
    name: titleCell,
    sourceName: name,
    columns,
    rows,
    total: sheetTotal(rows, amountCol),
    totalCol: amountCol,
  };
}

function looksLikeBudget(parsed: ParsedBudgetSheet): boolean {
  const header = normalize(parsed.columns.join(' '));
  return header.includes('descripcion') && header.includes('valor');
}

function pickBudgetSheet(parsed: ParsedBudgetSheet[]): ParsedBudgetSheet | undefined {
  const exact = parsed.find((sheet) => normalize(sheet.sourceName) === 'presupuesto');
  if (exact) return exact;
  const withTotal = parsed
    .filter((sheet) => sheet.rows.some((row) => row.kind === 'total' && (row.amounts[sheet.totalCol] ?? 0) > 0))
    .sort((a, b) => a.rows.length - b.rows.length);
  if (withTotal[0]) return withTotal[0];
  const budget = parsed.filter(looksLikeBudget).sort((a, b) => a.rows.length - b.rows.length);
  return budget[0] ?? parsed[0];
}

export function parseBudgetWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  equipment: Equipment[] = [],
): ParsedBudget {
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: true, cellText: true });
  const parsedSheets = workbook.SheetNames.map((name) => parseSheet(name, workbook.Sheets[name], equipment)).filter(
    (sheet): sheet is ParsedBudgetSheet => !!sheet && sheet.rows.length > 0,
  );
  const sheet = pickBudgetSheet(parsedSheets);
  const sheets = sheet ? [sheet] : [];
  return {
    title: sheet?.name || fileName,
    fileName,
    sheets,
    grandTotal: sheet?.total ?? 0,
  };
}
