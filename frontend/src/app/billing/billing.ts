import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="billing-page">
      <h1>Billing (Admin)</h1>
      <p>This is a placeholder. We'll design the billing details next.</p>
      <div class="placeholder-box">Future: revenue charts, subscription stats, invoices, refunds...</div>
    </div>
  `,
  styles: [`
    .billing-page { padding: 2rem; max-width: 960px; margin: 0 auto; }
    h1 { font-size: 1.9rem; margin-bottom: .75rem; }
    .placeholder-box { margin-top: 1.5rem; padding: 1rem 1.25rem; border: 1px dashed #999; border-radius: 8px; font-size: .95rem; color: #555; background: #fafafa; }
    :host-context(body.dark) .placeholder-box { background: #222; border-color: #444; color: #bbb; }
  `]
})
export class BillingComponent {}
