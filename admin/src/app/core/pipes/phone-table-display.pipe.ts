import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'phoneTableDisplay',
  standalone: true
})
export class PhoneTableDisplayPipe implements PipeTransform {
  
  // Country options with flags and codes
  private countryOptions = [
    { code: '+237', name: 'Cameroon', flag: '🇨🇲' },
    { code: '+1', name: 'United States', flag: '🇺🇸' },
    { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
    { code: '+33', name: 'France', flag: '🇫🇷' },
    { code: '+49', name: 'Germany', flag: '🇩🇪' },
    { code: '+234', name: 'Nigeria', flag: '🇳🇬' },
    { code: '+225', name: "Côte d'Ivoire", flag: '🇨🇮' },
    { code: '+221', name: 'Senegal', flag: '🇸🇳' },
    { code: '+233', name: 'Ghana', flag: '🇬🇭' },
    { code: '+256', name: 'Uganda', flag: '🇺🇬' },
    { code: '+254', name: 'Kenya', flag: '🇰🇪' },
    { code: '+255', name: 'Tanzania', flag: '🇹🇿' },
    { code: '+250', name: 'Rwanda', flag: '🇷🇼' },
    { code: '+27', name: 'South Africa', flag: '🇿🇦' },
    { code: '+212', name: 'Morocco', flag: '🇲🇦' },
    { code: '+216', name: 'Tunisia', flag: '🇹🇳' },
    { code: '+213', name: 'Algeria', flag: '🇩🇿' },
    { code: '+86', name: 'China', flag: '🇨🇳' },
    { code: '+91', name: 'India', flag: '🇮🇳' },
    { code: '+55', name: 'Brazil', flag: '🇧🇷' },
    { code: '+81', name: 'Japan', flag: '🇯🇵' },
    { code: '+82', name: 'South Korea', flag: '🇰🇷' },
    { code: '+61', name: 'Australia', flag: '🇦🇺' },
    { code: '+7', name: 'Russia', flag: '🇷🇺' },
    { code: '+34', name: 'Spain', flag: '🇪🇸' },
    { code: '+39', name: 'Italy', flag: '🇮🇹' },
    { code: '+351', name: 'Portugal', flag: '🇵🇹' },
    { code: '+31', name: 'Netherlands', flag: '🇳🇱' },
    { code: '+32', name: 'Belgium', flag: '🇧🇪' },
    { code: '+41', name: 'Switzerland', flag: '🇨🇭' },
    { code: '+46', name: 'Sweden', flag: '🇸🇪' },
    { code: '+47', name: 'Norway', flag: '🇳🇴' },
    { code: '+45', name: 'Denmark', flag: '🇩🇰' },
    { code: '+358', name: 'Finland', flag: '🇫🇮' },
    { code: '+48', name: 'Poland', flag: '🇵🇱' },
    { code: '+420', name: 'Czech Republic', flag: '🇨🇿' },
    { code: '+36', name: 'Hungary', flag: '🇭🇺' },
    { code: '+40', name: 'Romania', flag: '🇷🇴' },
    { code: '+30', name: 'Greece', flag: '🇬🇷' },
    { code: '+90', name: 'Turkey', flag: '🇹🇷' },
    { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+971', name: 'UAE', flag: '🇦🇪' },
    { code: '+974', name: 'Qatar', flag: '🇶🇦' },
    { code: '+965', name: 'Kuwait', flag: '🇰🇼' },
    { code: '+20', name: 'Egypt', flag: '🇪🇬' },
    { code: '+972', name: 'Israel', flag: '🇮🇱' },
    { code: '+52', name: 'Mexico', flag: '🇲🇽' },
    { code: '+54', name: 'Argentina', flag: '🇦🇷' },
    { code: '+56', name: 'Chile', flag: '🇨🇱' },
    { code: '+57', name: 'Colombia', flag: '🇨🇴' },
    { code: '+51', name: 'Peru', flag: '🇵🇪' },
    { code: '+63', name: 'Philippines', flag: '🇵🇭' },
    { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
    { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
    { code: '+65', name: 'Singapore', flag: '🇸🇬' },
    { code: '+66', name: 'Thailand', flag: '🇹🇭' },
    { code: '+84', name: 'Vietnam', flag: '🇻🇳' },
  ];

  transform(phone: string): string {
    if (!phone) {
      return '';
    }
    
    // Extract country code from phone number
    // Sort by code length descending to match longest codes first
    const sortedCodes = [...this.countryOptions].sort((a, b) => b.code.length - a.code.length);
    
    for (const country of sortedCodes) {
      if (phone.startsWith(country.code)) {
        const phoneNumber = phone.substring(country.code.length);
        return `${country.flag} ${country.code} ${phoneNumber}`;
      }
    }
    
    // If no country code matched, return phone number as-is
    return phone.startsWith('+') ? phone : '+' + phone;
  }
}
     