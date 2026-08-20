import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'danger' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  title: string;
  message: string;
  tone: ToastTone;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UiFeedbackService {
  readonly toasts = signal<ToastMessage[]>([]);
  readonly confirmDialog = signal<ConfirmOptions | null>(null);

  private toastSeq = 0;
  private confirmResolve: ((ok: boolean) => void) | null = null;

  toast(message: string, tone: ToastTone = 'info', title?: string): void {
    const id = ++this.toastSeq;
    const heading =
      title ??
      (tone === 'success' ? 'Listo' : tone === 'danger' ? 'No se pudo completar' : tone === 'warning' ? 'Atención' : 'Aviso');
    this.toasts.update((list) => [...list, { id, title: heading, message, tone }]);
    window.setTimeout(() => this.dismiss(id), 4200);
  }

  success(message: string): void {
    this.toast(message, 'success');
  }

  error(message: string): void {
    this.toast(message, 'danger');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((item) => item.id !== id));
  }

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.confirmDialog.set({
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      ...options,
    });
    return new Promise((resolve) => {
      this.confirmResolve = resolve;
    });
  }

  answer(ok: boolean): void {
    this.confirmDialog.set(null);
    this.confirmResolve?.(ok);
    this.confirmResolve = null;
  }
}
