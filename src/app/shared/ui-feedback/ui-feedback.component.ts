import { Component, inject } from '@angular/core';
import { UiFeedbackService } from './ui-feedback.service';

@Component({
  selector: 'app-ui-feedback',
  templateUrl: './ui-feedback.component.html',
  styleUrl: './ui-feedback.component.scss',
})
export class UiFeedbackComponent {
  readonly ui = inject(UiFeedbackService);

  icon(tone: string): string {
    if (tone === 'success') return 'check_circle';
    if (tone === 'danger') return 'error';
    if (tone === 'warning') return 'warning';
    return 'info';
  }
}
