// Noms `properties.name` du fond de carte topojson servi en asset statique
// (public/geo/world-countries-50m.json, dérivé de world-atlas
// countries-50m.json). Recopiés ici en dur plutôt que lus dynamiquement pour
// rester une fonction pure, testable sans dépendre du fichier statique ni du
// DOM (voir design.md §2, décision 2). Liste générée à partir de
// `node_modules/world-atlas/countries-50m.json` au moment de
// l'implémentation (241 géométries, résolution 50m).
const TOPOJSON_COUNTRY_NAMES = [
  "Afghanistan", "Albania", "Algeria", "American Samoa", "Andorra", "Angola",
  "Anguilla", "Antarctica", "Antigua and Barb.", "Argentina", "Armenia",
  "Aruba", "Ashmore and Cartier Is.", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia and Herz.",
  "Botswana", "Br. Indian Ocean Ter.", "Brazil", "British Virgin Is.",
  "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Cayman Is.", "Central African Rep.", "Chad",
  "Chile", "China", "Colombia", "Comoros", "Congo", "Cook Is.",
  "Costa Rica", "Croatia", "Cuba", "Curaçao", "Cyprus", "Czechia",
  "Côte d'Ivoire", "Dem. Rep. Congo", "Denmark", "Djibouti", "Dominica",
  "Dominican Rep.", "Ecuador", "Egypt", "El Salvador", "Eq. Guinea",
  "Eritrea", "Estonia", "Ethiopia", "Faeroe Is.", "Falkland Is.", "Fiji",
  "Finland", "Fr. Polynesia", "Fr. S. Antarctic Lands", "France", "Gabon",
  "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Greenland",
  "Grenada", "Guam", "Guatemala", "Guernsey", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Heard I. and McDonald Is.", "Honduras", "Hong Kong",
  "Hungary", "Iceland", "India", "Indian Ocean Ter.", "Indonesia", "Iran",
  "Iraq", "Ireland", "Isle of Man", "Israel", "Italy", "Jamaica", "Japan",
  "Jersey", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho",
  "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macao",
  "Macedonia", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali",
  "Malta", "Marshall Is.", "Mauritania", "Mauritius", "Mexico",
  "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro",
  "Montserrat", "Morocco", "Mozambique", "Myanmar", "N. Cyprus",
  "N. Mariana Is.", "Namibia", "Nauru", "Nepal", "Netherlands",
  "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue",
  "Norfolk Island", "North Korea", "Norway", "Oman", "Pakistan", "Palau",
  "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru",
  "Philippines", "Pitcairn Is.", "Poland", "Portugal", "Puerto Rico",
  "Qatar", "Romania", "Russia", "Rwanda", "S. Geo. and the Is.",
  "S. Sudan", "Saint Helena", "Saint Lucia", "Samoa", "San Marino",
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Siachen Glacier",
  "Sierra Leone", "Singapore", "Sint Maarten", "Slovakia", "Slovenia",
  "Solomon Is.", "Somalia", "Somaliland", "South Africa", "South Korea",
  "Spain", "Sri Lanka", "St-Barthélemy", "St-Martin", "St. Kitts and Nevis",
  "St. Pierre and Miquelon", "St. Vin. and Gren.", "Sudan", "Suriname",
  "Sweden", "Switzerland", "Syria", "São Tomé and Principe", "Taiwan",
  "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
  "Turks and Caicos Is.", "U.S. Virgin Is.", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States of America",
  "Uruguay", "Uzbekistan", "Vanuatu", "Vatican", "Venezuela", "Vietnam",
  "W. Sahara", "Wallis and Futuna Is.", "Yemen", "Zambia", "Zimbabwe",
  "eSwatini", "Åland",
] as const;

const TOPOJSON_NAME_BY_LOWER = new Map(
  TOPOJSON_COUNTRY_NAMES.map((name) => [name.toLowerCase(), name]),
);

// Variantes anglaises courantes du texte libre `messages.country` qui ne
// correspondent pas exactement (même en casse-insensible) à un
// `properties.name` du fond de carte. Couvre les valeurs déjà vues dans les
// données d'exemple (`UK`, `USA`, `Czech Republic`) plus quelques alias
// usuels ; non exhaustif par choix (voir design.md, Non-Goals) — un pays
// absent d'ici reste visible dans le classement, simplement pas colorable
// sur la carte (voir resolveMapCountryName).
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "usa": "United States of America",
  "u.s.a.": "United States of America",
  "us": "United States of America",
  "united states": "United States of America",
  "czech republic": "Czechia",
  "korea, south": "South Korea",
  "republic of korea": "South Korea",
  "korea, north": "North Korea",
  "democratic people's republic of korea": "North Korea",
  "ivory coast": "Côte d'Ivoire",
  "dr congo": "Dem. Rep. Congo",
  "democratic republic of the congo": "Dem. Rep. Congo",
  "congo-brazzaville": "Congo",
  "republic of the congo": "Congo",
  "bosnia": "Bosnia and Herz.",
  "bosnia and herzegovina": "Bosnia and Herz.",
  "dominican republic": "Dominican Rep.",
  "central african republic": "Central African Rep.",
  "equatorial guinea": "Eq. Guinea",
  "western sahara": "W. Sahara",
  "north macedonia": "Macedonia",
  "swaziland": "eSwatini",
  "burma": "Myanmar",
  "east timor": "Timor-Leste",
};

// Fonction pure, testable sans base de données ni fichier statique (même
// style que tokenize/rankWordFrequencies de sentiment-word-cloud.ts) :
// normalise la valeur brute puis tente une correspondance exacte
// insensible à la casse contre les noms du fond de carte, sinon une table
// d'alias. Retourne `null` si aucune correspondance : la valeur reste
// visible dans le classement mais ne colore aucune zone de la carte (voir
// Requirement: Country Code Mapping For Map Rendering).
export function resolveMapCountryName(rawCountry: string | null | undefined): string | null {
  const normalized = rawCountry?.trim().toLowerCase();
  if (!normalized) return null;

  return TOPOJSON_NAME_BY_LOWER.get(normalized) ?? COUNTRY_NAME_ALIASES[normalized] ?? null;
}
