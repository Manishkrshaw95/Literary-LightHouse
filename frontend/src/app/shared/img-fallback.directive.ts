import { Directive, HostListener, Input, ElementRef } from '@angular/core';

@Directive({
  selector: '[imgFallback]'
})
export class ImgFallbackDirective {
  @Input('imgFallback') fallback: string = 'placeholder.jpg';

  constructor(private el: ElementRef<HTMLImageElement>) {}

  @HostListener('error')
  onError() {
    const img: HTMLImageElement = this.el.nativeElement;
    if (img.src && !img.src.endsWith(this.fallback)) {
      img.src = this.fallback;
    }
  }
}
