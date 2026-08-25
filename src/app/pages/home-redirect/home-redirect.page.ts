import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/** Redirección a la home del tenant (evita hardcode /dashboard). */
@Component({
  selector: 'app-home-redirect',
  template: '',
})
export class HomeRedirectPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.router.navigateByUrl(this.auth.homeRoute(), { replaceUrl: true });
  }
}
