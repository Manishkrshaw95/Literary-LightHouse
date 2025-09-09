import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SearchService {
  // BehaviorSubject provides an observable stream for reactive subscribers
  private _termSubject = new BehaviorSubject<string>('');
  term$ = this._termSubject.asObservable();

  // also keep a signal for simple reads if needed
  private _termSignal = signal<string>('');

  get term() {
    return this._termSignal();
  }

  setTerm(value: string) {
    const v = (value || '').trim();
    // push to subject immediately; subscribers can debounce as needed
    this._termSubject.next(v);
    // sync signal for immediate reads
    this._termSignal.set(v);
  }

  /** Immediately set the term (same as setTerm here) */
  commitNow(value: string) {
    this.setTerm(value);
  }
}
