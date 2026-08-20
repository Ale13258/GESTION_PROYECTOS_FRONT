import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { EQUIPMENT_FOLDER_SEGMENTS, PROJECT_FOLDER_SEGMENTS, equipmentStorageKey, projectStorageKey } from './storage-paths';

@Injectable({ providedIn: 'root' })
export class FirebaseStorageService {
  private readonly bucket = environment.firebase.storageBucket
    .replace(/^gs:\/\//, '')
    .replace(/\/$/, '');

  private readonly ensuredProjects = new Set<string>();
  private readonly ensuredEquipment = new Set<string>();

  async upload(folder: string, file: File): Promise<{ url: string; path: string }> {
    const safeName = file.name.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, '_');
    const path = `${folder.replace(/^\/+|\/+$/g, '')}/${crypto.randomUUID()}-${safeName}`;
    return this.putObject(path, file, file.type || 'application/octet-stream');
  }

  async ensureProjectFolders(projectId: string, projectName?: string): Promise<void> {
    const key = projectStorageKey(projectId, projectName);
    if (!projectId || this.ensuredProjects.has(key)) return;
    this.ensuredProjects.add(key);
    await Promise.all(
      PROJECT_FOLDER_SEGMENTS.map((folder) =>
        this.putPlaceholder(`proyectos/${key}/${folder}/.keep`),
      ),
    );
  }

  async listPrefix(prefix: string): Promise<{ name: string; downloadTokens?: string }[]> {
    const items: { name: string; downloadTokens?: string }[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ prefix, maxResults: '1000' });
      if (pageToken) params.set('pageToken', pageToken);
      const listed = await fetch(`https://firebasestorage.googleapis.com/v0/b/${this.bucket}/o?${params}`);
      if (!listed.ok) {
        throw new Error(this.explainStorageError(listed.status, await listed.text()));
      }
      const payload = (await listed.json()) as {
        items?: { name: string; downloadTokens?: string }[];
        nextPageToken?: string;
      };
      items.push(...(payload.items ?? []));
      pageToken = payload.nextPageToken;
    } while (pageToken);
    return items;
  }

  async copyObject(
    source: { name: string; downloadTokens?: string; url?: string },
    destPath: string,
  ): Promise<{ url: string; path: string }> {
    const downloadUrl =
      source.url ??
      `https://firebasestorage.googleapis.com/v0/b/${this.bucket}/o/${encodeURIComponent(source.name)}?alt=media${
        source.downloadTokens ? `&token=${encodeURIComponent(source.downloadTokens)}` : ''
      }`;
    const downloaded = await fetch(downloadUrl);
    if (!downloaded.ok) {
      throw new Error(this.explainStorageError(downloaded.status, await downloaded.text()));
    }
    const body = await downloaded.blob();
    const contentType = body.type || downloaded.headers.get('content-type') || 'application/octet-stream';
    return this.putObject(destPath, body, contentType);
  }

  async deleteObject(path: string): Promise<void> {
    const deleted = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${this.bucket}/o/${encodeURIComponent(path)}`,
      { method: 'DELETE' },
    );
    if (!deleted.ok && deleted.status !== 404) {
      throw new Error(this.explainStorageError(deleted.status, await deleted.text()));
    }
  }

  async ensureEquipmentFolders(
    projectId: string,
    equipmentId: string,
    projectName?: string,
    equipmentName?: string,
  ): Promise<void> {
    const projectKey = projectStorageKey(projectId, projectName);
    const equipmentKey = equipmentStorageKey(equipmentId, equipmentName);
    const cacheKey = `${projectKey}:${equipmentKey}`;
    if (!projectId || !equipmentId || this.ensuredEquipment.has(cacheKey)) return;
    this.ensuredEquipment.add(cacheKey);
    await Promise.all(
      EQUIPMENT_FOLDER_SEGMENTS.map((folder) =>
        this.putPlaceholder(`proyectos/${projectKey}/equipos/${equipmentKey}/${folder}/.keep`),
      ),
    );
  }

  private async putPlaceholder(path: string): Promise<void> {
    try {
      await this.putObject(path, new Blob([''], { type: 'text/plain' }), 'text/plain');
    } catch {
      /* si la carpeta ya existe o las reglas bloquean, no interrumpe la app */
    }
  }

  private async putObject(
    path: string,
    body: Blob,
    contentType: string,
  ): Promise<{ url: string; path: string }> {
    const uploadUrl =
      `https://firebasestorage.googleapis.com/v0/b/${this.bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`;
    const uploaded = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    });
    if (!uploaded.ok) {
      throw new Error(this.explainStorageError(uploaded.status, await uploaded.text()));
    }
    const payload = (await uploaded.json()) as { downloadTokens?: string; name?: string };
    const tokenParam = payload.downloadTokens
      ? `&token=${encodeURIComponent(payload.downloadTokens)}`
      : '';
    const url =
      `https://firebasestorage.googleapis.com/v0/b/${this.bucket}/o/${encodeURIComponent(path)}?alt=media${tokenParam}`;
    return { url, path: payload.name ?? path };
  }

  private explainStorageError(status: number, detail: string): string {
    if (status === 404) {
      return `No se encontró el bucket gs://${this.bucket}.`;
    }
    if (status === 403) {
      return 'Las reglas de Storage bloquean la escritura. En Rules permite write.';
    }
    return `No se pudo subir a Firebase (${status}): ${detail}`;
  }
}
