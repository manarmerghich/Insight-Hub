import { describe, expect, it } from "vitest";

import { resolveMapCountryName } from "@/db/country-geo-mapping";

describe("resolveMapCountryName", () => {
  it("fait correspondre un nom exact au nom topojson", () => {
    expect(resolveMapCountryName("France")).toBe("France");
    expect(resolveMapCountryName("Germany")).toBe("Germany");
  });

  it("ignore la casse pour une correspondance exacte", () => {
    expect(resolveMapCountryName("france")).toBe("France");
    expect(resolveMapCountryName("FRANCE")).toBe("France");
  });

  it("ignore les espaces superflus", () => {
    expect(resolveMapCountryName("  France  ")).toBe("France");
  });

  it("résout les alias anglais courants vus dans les données d'exemple", () => {
    expect(resolveMapCountryName("UK")).toBe("United Kingdom");
    expect(resolveMapCountryName("USA")).toBe("United States of America");
    expect(resolveMapCountryName("Czech Republic")).toBe("Czechia");
  });

  it("résout un alias avec casse et espaces variables", () => {
    expect(resolveMapCountryName("  usa  ")).toBe("United States of America");
    expect(resolveMapCountryName("Czech republic")).toBe("Czechia");
  });

  it("résout d'autres alias usuels listés dans le design", () => {
    expect(resolveMapCountryName("Ivory Coast")).toBe("Côte d'Ivoire");
    expect(resolveMapCountryName("DR Congo")).toBe("Dem. Rep. Congo");
    expect(resolveMapCountryName("Democratic Republic of the Congo")).toBe("Dem. Rep. Congo");
    expect(resolveMapCountryName("Republic of the Congo")).toBe("Congo");
    expect(resolveMapCountryName("Bosnia and Herzegovina")).toBe("Bosnia and Herz.");
    expect(resolveMapCountryName("Dominican Republic")).toBe("Dominican Rep.");
    expect(resolveMapCountryName("Central African Republic")).toBe("Central African Rep.");
    expect(resolveMapCountryName("Equatorial Guinea")).toBe("Eq. Guinea");
    expect(resolveMapCountryName("Western Sahara")).toBe("W. Sahara");
    expect(resolveMapCountryName("North Macedonia")).toBe("Macedonia");
    expect(resolveMapCountryName("Swaziland")).toBe("eSwatini");
    expect(resolveMapCountryName("Burma")).toBe("Myanmar");
    expect(resolveMapCountryName("East Timor")).toBe("Timor-Leste");
  });

  it("résout les noms qui correspondent déjà directement sans alias", () => {
    expect(resolveMapCountryName("South Korea")).toBe("South Korea");
    expect(resolveMapCountryName("North Korea")).toBe("North Korea");
  });

  it("retourne null pour une valeur non reconnue", () => {
    expect(resolveMapCountryName("Wakanda")).toBeNull();
    expect(resolveMapCountryName("Planète Mars")).toBeNull();
  });

  it("retourne null pour une valeur vide ou absente", () => {
    expect(resolveMapCountryName("")).toBeNull();
    expect(resolveMapCountryName("   ")).toBeNull();
    expect(resolveMapCountryName(null)).toBeNull();
    expect(resolveMapCountryName(undefined)).toBeNull();
  });
});
