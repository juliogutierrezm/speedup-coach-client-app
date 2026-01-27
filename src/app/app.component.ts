import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],
  template: `<router-outlet></router-outlet>`
})
export class AppComponent implements OnInit {
  constructor() {}

  async ngOnInit() {
    // Auth state is resolved by guards when needed
  }
}

