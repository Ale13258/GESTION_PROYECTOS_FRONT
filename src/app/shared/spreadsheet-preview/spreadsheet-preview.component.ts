import { Component, effect, input, signal } from '@angular/core';
import * as XLSX from 'xlsx';

const MAX_ROWS = 1000;
const MAX_COLS = 60;

@Component({
  selector: 'app-spreadsheet-preview',
  templateUrl: './spreadsheet-preview.component.html',
  styleUrl: './spreadsheet-preview.component.scss',
})
export class SpreadsheetPreviewComponent {
  readonly fileUrl = input('');
  readonly fileName = input('archivo.xlsx');
  readonly downloadUrl = input('');

  readonly loading = signal(true);
  readonly error = signal('');
  readonly sheetNames = signal<string[]>([]);
  readonly activeSheet = signal('');
  readonly rows = signal<string[][]>([]);
  readonly truncated = signal(false);

  private workbook: XLSX.WorkBook | null = null;
  private loadToken = 0;

  constructor() {
    effect(() => {
      const url = this.fileUrl();
      if (!url) return;
      void this.open(url, this.fileName());
    });
  }

  selectSheet(name: string): void {
    this.activeSheet.set(name);
    this.renderSheet(name);
  }

  colLabel(index: number): string {
    let n = index + 1;
    let label = '';
    while (n > 0) {
      n -= 1;
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26);
    }
    return label;
  }

  private async open(url: string, name: string): Promise<void> {
    const token = ++this.loadToken;
    this.loading.set(true);
    this.error.set('');
    this.sheetNames.set([]);
    this.rows.set([]);
    this.truncated.set(false);
    this.workbook = null;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`No se pudo descargar el Excel (${response.status}).`);
      }
      const buffer = await response.arrayBuffer();
      if (token !== this.loadToken) return;

      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheets = workbook.SheetNames.filter(Boolean);
      if (!sheets.length) {
        throw new Error('El archivo no contiene hojas para visualizar.');
      }

      this.workbook = workbook;
      this.sheetNames.set(sheets);
      this.activeSheet.set(sheets[0]);
      this.renderSheet(sheets[0]);
    } catch (error) {
      if (token !== this.loadToken) return;
      this.error.set(
        error instanceof Error ? error.message : `No se pudo abrir “${name}”.`,
      );
    } finally {
      if (token === this.loadToken) this.loading.set(false);
    }
  }

  private renderSheet(name: string): void {
    const sheet = this.workbook?.Sheets[name];
    if (!sheet) {
      this.rows.set([]);
      return;
    }

    const data = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    const truncated = data.length > MAX_ROWS || data.some((row) => (row?.length ?? 0) > MAX_COLS);
    const sliced = data.slice(0, MAX_ROWS).map((row) =>
      (row ?? []).slice(0, MAX_COLS).map((cell) => (cell == null ? '' : String(cell))),
    );
    const width = Math.max(1, ...sliced.map((row) => row.length));
    this.rows.set(
      sliced.map((row) => {
        const next = [...row];
        while (next.length < width) next.push('');
        return next;
      }),
    );
    this.truncated.set(truncated);
  }
}
