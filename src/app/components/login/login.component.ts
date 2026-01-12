import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Check if user is already authenticated
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
      this.router.navigate(['/plans']);
      }
    });
  }

  async signInWithHostedUI() {
    this.loading = true;
    await this.authService.signInWithRedirect();
  }

  async signUpWithHostedUI() {
    this.loading = true;
    // For now, sign up also redirects to the hosted UI where users can choose to sign up.
    await this.authService.signInWithRedirect();
  }
}
