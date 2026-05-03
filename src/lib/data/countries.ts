/**
 * ISO-3166-1 alpha-2 country list with Arabic + English names.
 * Used for onboarding, profile editing, and task posting.
 */

export interface Country {
  code: string; // ISO-2
  ar: string;
  en: string;
}

export const COUNTRIES: Country[] = [
  { code: "SA", ar: "السعودية", en: "Saudi Arabia" },
  { code: "AE", ar: "الإمارات", en: "United Arab Emirates" },
  { code: "EG", ar: "مصر", en: "Egypt" },
  { code: "MA", ar: "المغرب", en: "Morocco" },
  { code: "DZ", ar: "الجزائر", en: "Algeria" },
  { code: "TN", ar: "تونس", en: "Tunisia" },
  { code: "LY", ar: "ليبيا", en: "Libya" },
  { code: "SD", ar: "السودان", en: "Sudan" },
  { code: "JO", ar: "الأردن", en: "Jordan" },
  { code: "LB", ar: "لبنان", en: "Lebanon" },
  { code: "SY", ar: "سوريا", en: "Syria" },
  { code: "IQ", ar: "العراق", en: "Iraq" },
  { code: "PS", ar: "فلسطين", en: "Palestine" },
  { code: "YE", ar: "اليمن", en: "Yemen" },
  { code: "OM", ar: "عُمان", en: "Oman" },
  { code: "QA", ar: "قطر", en: "Qatar" },
  { code: "BH", ar: "البحرين", en: "Bahrain" },
  { code: "KW", ar: "الكويت", en: "Kuwait" },
  { code: "MR", ar: "موريتانيا", en: "Mauritania" },
  { code: "SO", ar: "الصومال", en: "Somalia" },
  { code: "DJ", ar: "جيبوتي", en: "Djibouti" },
  { code: "KM", ar: "جزر القمر", en: "Comoros" },
  { code: "TR", ar: "تركيا", en: "Turkey" },
  { code: "IR", ar: "إيران", en: "Iran" },
  { code: "PK", ar: "باكستان", en: "Pakistan" },
  { code: "IN", ar: "الهند", en: "India" },
  { code: "BD", ar: "بنغلاديش", en: "Bangladesh" },
  { code: "ID", ar: "إندونيسيا", en: "Indonesia" },
  { code: "MY", ar: "ماليزيا", en: "Malaysia" },
  { code: "SG", ar: "سنغافورة", en: "Singapore" },
  { code: "PH", ar: "الفلبين", en: "Philippines" },
  { code: "TH", ar: "تايلاند", en: "Thailand" },
  { code: "VN", ar: "فيتنام", en: "Vietnam" },
  { code: "CN", ar: "الصين", en: "China" },
  { code: "JP", ar: "اليابان", en: "Japan" },
  { code: "KR", ar: "كوريا الجنوبية", en: "South Korea" },
  { code: "AF", ar: "أفغانستان", en: "Afghanistan" },
  { code: "AZ", ar: "أذربيجان", en: "Azerbaijan" },
  { code: "KZ", ar: "كازاخستان", en: "Kazakhstan" },
  { code: "UZ", ar: "أوزبكستان", en: "Uzbekistan" },
  { code: "TM", ar: "تركمانستان", en: "Turkmenistan" },
  { code: "KG", ar: "قيرغيزستان", en: "Kyrgyzstan" },
  { code: "TJ", ar: "طاجيكستان", en: "Tajikistan" },
  { code: "GB", ar: "المملكة المتحدة", en: "United Kingdom" },
  { code: "US", ar: "الولايات المتحدة", en: "United States" },
  { code: "CA", ar: "كندا", en: "Canada" },
  { code: "MX", ar: "المكسيك", en: "Mexico" },
  { code: "BR", ar: "البرازيل", en: "Brazil" },
  { code: "AR", ar: "الأرجنتين", en: "Argentina" },
  { code: "CL", ar: "تشيلي", en: "Chile" },
  { code: "CO", ar: "كولومبيا", en: "Colombia" },
  { code: "PE", ar: "بيرو", en: "Peru" },
  { code: "VE", ar: "فنزويلا", en: "Venezuela" },
  { code: "FR", ar: "فرنسا", en: "France" },
  { code: "DE", ar: "ألمانيا", en: "Germany" },
  { code: "IT", ar: "إيطاليا", en: "Italy" },
  { code: "ES", ar: "إسبانيا", en: "Spain" },
  { code: "PT", ar: "البرتغال", en: "Portugal" },
  { code: "NL", ar: "هولندا", en: "Netherlands" },
  { code: "BE", ar: "بلجيكا", en: "Belgium" },
  { code: "CH", ar: "سويسرا", en: "Switzerland" },
  { code: "AT", ar: "النمسا", en: "Austria" },
  { code: "SE", ar: "السويد", en: "Sweden" },
  { code: "NO", ar: "النرويج", en: "Norway" },
  { code: "DK", ar: "الدنمارك", en: "Denmark" },
  { code: "FI", ar: "فنلندا", en: "Finland" },
  { code: "IE", ar: "أيرلندا", en: "Ireland" },
  { code: "PL", ar: "بولندا", en: "Poland" },
  { code: "CZ", ar: "التشيك", en: "Czechia" },
  { code: "GR", ar: "اليونان", en: "Greece" },
  { code: "RO", ar: "رومانيا", en: "Romania" },
  { code: "HU", ar: "المجر", en: "Hungary" },
  { code: "RU", ar: "روسيا", en: "Russia" },
  { code: "UA", ar: "أوكرانيا", en: "Ukraine" },
  { code: "AU", ar: "أستراليا", en: "Australia" },
  { code: "NZ", ar: "نيوزيلندا", en: "New Zealand" },
  { code: "ZA", ar: "جنوب أفريقيا", en: "South Africa" },
  { code: "NG", ar: "نيجيريا", en: "Nigeria" },
  { code: "KE", ar: "كينيا", en: "Kenya" },
  { code: "ET", ar: "إثيوبيا", en: "Ethiopia" },
  { code: "GH", ar: "غانا", en: "Ghana" },
  { code: "SN", ar: "السنغال", en: "Senegal" },
  { code: "CI", ar: "ساحل العاج", en: "Côte d'Ivoire" },
  { code: "CM", ar: "الكاميرون", en: "Cameroon" },
  { code: "TZ", ar: "تنزانيا", en: "Tanzania" },
  { code: "UG", ar: "أوغندا", en: "Uganda" },
  { code: "OTHER", ar: "أخرى", en: "Other" },
];

const VALID_CODES = new Set(COUNTRIES.map((c) => c.code));

export function isValidCountryCode(code: unknown): code is string {
  return typeof code === "string" && VALID_CODES.has(code);
}

export function getCountryName(
  code: string | null | undefined,
  lang: "ar" | "en" = "ar",
): string {
  if (!code) return "";
  const c = COUNTRIES.find((x) => x.code === code);
  if (!c) return code;
  return lang === "ar" ? c.ar : c.en;
}