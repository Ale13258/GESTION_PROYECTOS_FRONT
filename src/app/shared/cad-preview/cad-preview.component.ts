import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  Dwg_File_Type,
  DwgThumbnail,
  DwgThumbnailImageType,
  LibreDwg,
} from '@mlightcad/libredwg-web';

type CadEngine = Awaited<ReturnType<typeof LibreDwg.create>>;

let enginePromise: Promise<CadEngine> | null = null;

function loadCadEngine(): Promise<CadEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      try {
        return await LibreDwg.create('/wasm');
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return await LibreDwg.create('/wasm');
      }
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

@Component({
  selector: 'app-cad-preview',
  templateUrl: './cad-preview.component.html',
  styleUrl: './cad-preview.component.scss',
})
export class CadPreviewComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private loadToken = 0;
  private thumbObjectUrl: string | null = null;

  readonly fileUrl = input('');
  readonly fileName = input('plano.dwg');
  readonly downloadUrl = input('');

  readonly loading = signal(true);
  readonly loadingLabel = signal('Preparando visor…');
  readonly error = signal('');
  readonly svgHtml = signal<SafeHtml | null>(null);
  readonly thumbnailUrl = signal<string | null>(null);
  readonly zoom = signal(1);

  constructor() {
    void loadCadEngine();

    effect(() => {
      const url = this.fileUrl();
      const name = this.fileName();
      if (!url) return;
      void this.openFile(url, name);
    });

    this.destroyRef.onDestroy(() => this.revokeThumb());
  }

  zoomPercent(): number {
    return Math.round(this.zoom() * 100);
  }

  zoomIn(): void {
    this.zoom.update((value) => Math.min(6, Number((value + 0.25).toFixed(2))));
  }

  zoomOut(): void {
    this.zoom.update((value) => Math.max(0.25, Number((value - 0.25).toFixed(2))));
  }

  resetZoom(): void {
    this.zoom.set(1);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  private async openFile(url: string, name: string): Promise<void> {
    const token = ++this.loadToken;
    this.loading.set(true);
    this.loadingLabel.set('Descargando el plano…');
    this.error.set('');
    this.svgHtml.set(null);
    this.thumbnailUrl.set(null);
    this.zoom.set(1);
    this.revokeThumb();

    try {
      const buffer = await this.readFile(url, this.downloadUrl());
      if (token !== this.loadToken) return;

      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      if (ext === 'dxf') {
        throw new Error('Los archivos DXF se pueden descargar para abrirlos en AutoCAD.');
      }

      this.loadingLabel.set('Cargando el visor CAD…');
      let libredwg: CadEngine;
      try {
        libredwg = await loadCadEngine();
      } catch {
        throw new Error('No se pudo iniciar el visor CAD. Cierra e inténtalo de nuevo.');
      }
      if (token !== this.loadToken) return;

      this.loadingLabel.set('Leyendo el DWG…');
      const dwg = libredwg.dwg_read_data(buffer, Dwg_File_Type.DWG);
      if (!dwg) {
        throw new Error('No se pudo leer el plano DWG/BAK.');
      }

      const thumb = libredwg.dwg_bmp(dwg);
      const thumbUrl = this.toThumbnailUrl(thumb);
      if (thumbUrl) {
        this.thumbObjectUrl = thumbUrl;
        this.thumbnailUrl.set(thumbUrl);
        this.loadingLabel.set('Mejorando el dibujo…');
      }

      this.loadingLabel.set('Dibujando el plano…');
      const database = libredwg.convert(dwg);
      const svg = libredwg.dwg_to_svg(database);
      libredwg.dwg_free(dwg);

      if (token !== this.loadToken) return;

      if (svg && /<(path|line|polyline|circle|ellipse|text|polygon)\b/i.test(svg)) {
        this.svgHtml.set(this.sanitizer.bypassSecurityTrustHtml(svg));
      } else if (!thumbUrl) {
        throw new Error('Este plano no se pudo dibujar en el visor.');
      }
    } catch (error) {
      if (token !== this.loadToken) return;
      this.error.set(this.explainError(error));
    } finally {
      if (token === this.loadToken) this.loading.set(false);
    }
  }

  private async readFile(url: string, fallbackUrl = ''): Promise<ArrayBuffer> {
    const candidates = [url, fallbackUrl].filter((value, index, list) => value && list.indexOf(value) === index);
    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate);
        if (!response.ok) {
          lastError = new Error(`No se pudo descargar el plano (${response.status}).`);
          continue;
        }
        return response.arrayBuffer();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('No se pudo descargar el plano.');
  }

  private explainError(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return 'No se pudo cargar el plano. Cierra el visor e inténtalo de nuevo.';
    }
    return message || 'No se pudo visualizar el archivo CAD.';
  }

  private toThumbnailUrl(thumb: DwgThumbnail | null): string | null {
    if (!thumb?.data?.length) return null;
    if (thumb.type === DwgThumbnailImageType.WMF) return null;
    const bytes =
      thumb.type === DwgThumbnailImageType.PNG ? thumb.data : this.dibToBmp(thumb.data);
    const type = thumb.type === DwgThumbnailImageType.PNG ? 'image/png' : 'image/bmp';
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return URL.createObjectURL(new Blob([copy.buffer], { type }));
  }

  private dibToBmp(dib: Uint8Array): Uint8Array {
    if (dib.length >= 2 && dib[0] === 0x42 && dib[1] === 0x4d) return dib;
    const view = new DataView(dib.buffer, dib.byteOffset, dib.byteLength);
    const dibHeader = dib.length >= 4 ? view.getUint32(0, true) : 40;
    const bitCount = dib.length >= 18 ? view.getUint16(14, true) : 24;
    const colorsUsed = dib.length >= 36 ? view.getUint32(32, true) : 0;
    const paletteBytes = bitCount <= 8 ? (colorsUsed || 1 << bitCount) * 4 : 0;
    const pixelOffset = 14 + dibHeader + paletteBytes;
    const out = new Uint8Array(14 + dib.length);
    out[0] = 0x42;
    out[1] = 0x4d;
    const header = new DataView(out.buffer);
    header.setUint32(2, out.length, true);
    header.setUint32(10, pixelOffset, true);
    out.set(dib, 14);
    return out;
  }

  private revokeThumb(): void {
    if (this.thumbObjectUrl) {
      URL.revokeObjectURL(this.thumbObjectUrl);
      this.thumbObjectUrl = null;
    }
  }
}
