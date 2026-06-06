import { PhoneNumberFormat, PhoneNumberUtil } from 'google-libphonenumber';

const phoneUtil = PhoneNumberUtil.getInstance();

export interface ParsedPhoneDisplay {
  iso2: string | null;
  nationalNumber: string;
  raw: string;
}

function cleanPhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, '');
}

function toE164(raw: string): string {
  const cleaned = cleanPhone(raw);
  if (!cleaned) {
    return '';
  }
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function parseWithLibPhoneNumber(normalized: string): ParsedPhoneDisplay | null {
  try {
    const parsed = phoneUtil.parseAndKeepRawInput(normalized);
    const regionCode = phoneUtil.getRegionCodeForNumber(parsed);
    const iso2 = regionCode ? regionCode.toLowerCase() : null;
    const nationalNumber = phoneUtil.format(parsed, PhoneNumberFormat.NATIONAL).trim();

    return { iso2, nationalNumber, raw: normalized };
  } catch {
    return null;
  }
}

function parseWithDialCodeFallback(normalized: string, raw: string): ParsedPhoneDisplay | null {
  if (!normalized.startsWith('+')) {
    return null;
  }

  const digits = normalized.slice(1);
  for (let length = 3; length >= 1; length -= 1) {
    const countryCallingCode = Number(digits.slice(0, length));
    if (Number.isNaN(countryCallingCode)) {
      continue;
    }

    const regions = phoneUtil.getRegionCodesForCountryCode(countryCallingCode);
    if (!regions.length) {
      continue;
    }

    for (const region of regions) {
      try {
        const parsed = phoneUtil.parse(normalized, region);
        if (!phoneUtil.isValidNumber(parsed)) {
          continue;
        }

        const iso2 = phoneUtil.getRegionCodeForNumber(parsed)?.toLowerCase() ?? region.toLowerCase();
        const nationalNumber = phoneUtil.format(parsed, PhoneNumberFormat.NATIONAL).trim();
        return { iso2, nationalNumber, raw };
      } catch {
        continue;
      }
    }
  }

  return null;
}

export function parsePhoneForDisplay(phone: string | null | undefined): ParsedPhoneDisplay {
  const raw = phone?.trim() ?? '';

  if (!raw) {
    return { iso2: null, nationalNumber: '', raw: '' };
  }

  const normalized = toE164(raw);
  const parsed =
    parseWithLibPhoneNumber(normalized) ??
    parseWithDialCodeFallback(normalized, raw);

  if (parsed) {
    return parsed;
  }

  return { iso2: null, nationalNumber: raw, raw };
}

export function iso2ToFlagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export interface CountrySearchOption {
  iso2: string;
  name: string;
  dialCode: string;
  flag: string;
}

const PREFERRED_COUNTRY_CODES = ['CM', 'FR', 'US', 'GB'];

let cachedCountrySearchOptions: CountrySearchOption[] | null = null;

export function getCountrySearchOptions(): CountrySearchOption[] {
  if (cachedCountrySearchOptions) {
    return cachedCountrySearchOptions;
  }

  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const regions = phoneUtil.getSupportedRegions();

  const options = regions.map((iso2) => {
    const upperIso2 = iso2.toUpperCase();
    const dialCode = `+${phoneUtil.getCountryCodeForRegion(iso2)}`;

    return {
      iso2: iso2.toLowerCase(),
      name: displayNames.of(upperIso2) ?? upperIso2,
      dialCode,
      flag: iso2ToFlagEmoji(iso2.toLowerCase()),
    };
  });

  options.sort((a, b) => {
    const aPreferred = PREFERRED_COUNTRY_CODES.indexOf(a.iso2.toUpperCase());
    const bPreferred = PREFERRED_COUNTRY_CODES.indexOf(b.iso2.toUpperCase());

    if (aPreferred !== -1 || bPreferred !== -1) {
      if (aPreferred === -1) {
        return 1;
      }
      if (bPreferred === -1) {
        return -1;
      }
      return aPreferred - bPreferred;
    }

    return a.name.localeCompare(b.name);
  });

  cachedCountrySearchOptions = options;
  return options;
}

export function findCountryByIso2(iso2: string | null | undefined): CountrySearchOption | undefined {
  if (!iso2) {
    return undefined;
  }

  return getCountrySearchOptions().find((country) => country.iso2 === iso2.toLowerCase());
}

export function toPhoneSearchQuery(
  phoneNumber: string | null | undefined,
  selectedDialCode?: string | null,
): string | undefined {
  const digits = phoneNumber ? cleanPhone(phoneNumber) : '';

  if (digits) {
    const dialCode = selectedDialCode ? cleanPhone(selectedDialCode) : '';
    return dialCode ? `${dialCode}${digits}` : digits;
  }

  const fallbackDialCode = selectedDialCode ? cleanPhone(selectedDialCode) : '';
  return fallbackDialCode || undefined;
}

