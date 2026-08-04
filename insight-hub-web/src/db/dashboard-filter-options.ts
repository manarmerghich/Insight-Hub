import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { UNKNOWN_COUNTRY_LABEL } from "@/db/dashboard-filters";
import { messages, themes } from "@/db/schema";

const SENTIMENT_OPTIONS = ["positif", "négatif", "neutre"] as const;

export type DashboardFilterOptions = {
  platforms: string[];
  countries: string[];
  themes: { id: number; label: string }[];
  sentiments: readonly (typeof SENTIMENT_OPTIONS)[number][];
  dateBounds: { min: string; max: string } | null;
};

export async function getDashboardFilterOptions(
  runId: number | null,
): Promise<DashboardFilterOptions> {
  if (runId === null) {
    return { platforms: [], countries: [], themes: [], sentiments: SENTIMENT_OPTIONS, dateBounds: null };
  }

  const [platformRows, countryRows, themeRows, boundsRows] = await Promise.all([
    db
      .selectDistinct({ platform: messages.platform })
      .from(messages)
      .where(eq(messages.runId, runId)),
    db
      .selectDistinct({ country: messages.country })
      .from(messages)
      .where(eq(messages.runId, runId)),
    db
      .selectDistinct({ id: themes.id, label: themes.label })
      .from(themes)
      .innerJoin(
        messages,
        and(eq(messages.themeId, themes.id), eq(messages.themeStatus, "completed")),
      )
      .where(eq(messages.runId, runId)),
    db
      .select({
        min: sql<string | null>`to_char(min(${messages.timestamp}), 'YYYY-MM-DD')`,
        max: sql<string | null>`to_char(max(${messages.timestamp}), 'YYYY-MM-DD')`,
      })
      .from(messages)
      .where(eq(messages.runId, runId)),
  ]);

  const platforms = platformRows.map((row) => row.platform).sort();

  const hasUnknownCountry = countryRows.some((row) => !row.country?.trim());
  const countries = countryRows
    .map((row) => row.country?.trim())
    .filter((country): country is string => Boolean(country))
    .sort();
  if (hasUnknownCountry) countries.push(UNKNOWN_COUNTRY_LABEL);

  const themeOptions = themeRows
    .map((row) => ({ id: row.id, label: row.label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const bounds = boundsRows[0];
  const dateBounds = bounds?.min && bounds?.max ? { min: bounds.min, max: bounds.max } : null;

  return {
    platforms,
    countries,
    themes: themeOptions,
    sentiments: SENTIMENT_OPTIONS,
    dateBounds,
  };
}
