import { Pipe, PipeTransform } from '@angular/core';
import { iso2ToFlagEmoji, parsePhoneForDisplay } from 'src/app/core/utils/phone-display.util';

@Pipe({
  name: 'phoneTableDisplay',
  standalone: true
})
export class PhoneTableDisplayPipe implements PipeTransform {
  transform(phone: string | null | undefined): string {
    const parsed = parsePhoneForDisplay(phone);

    if (!parsed.raw) {
      return '';
    }

    if (parsed.iso2) {
      return `${iso2ToFlagEmoji(parsed.iso2)} ${parsed.nationalNumber}`;
    }

    return parsed.nationalNumber;
  }
}
