import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { messages } from "@/db/schema";

export const UNKNOWN_COUNTRY_LABEL = "Non renseigné";

export type DistributionEntry = {
  label: string;
  messageCount: number;
  share: number;
};

function withShares(rows: { label: string; messageCount: number }[]): DistributionEntry[] {
  const total = rows.reduce((sum, row) => sum + row.messageCount, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? row.messageCount / total : 0,
  }));
}

export async function getPlatformDistribution(runId: number | null): Promise<DistributionEntry[]> {
  if (runId === null) return [];

  const rows = await db
    .select({
      label: messages.platform,
      messageCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(messages)
    .where(eq(messages.runId, runId))
    .groupBy(messages.platform)
    .orderBy(desc(sql`count(*)`));

  return withShares(rows);
}

export async function getCountryDistribution(runId: number | null): Promise<DistributionEntry[]> {
  if (runId === null) return [];

  const rows = await db
    .select({
      country: messages.country,
      messageCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(messages)
    .where(eq(messages.runId, runId))
    .groupBy(messages.country);

  const byLabel = new Map<string, number>();
  for (const row of rows) {
    const label = row.country?.trim() ? row.country.trim() : UNKNOWN_COUNTRY_LABEL;
    byLabel.set(label, (byLabel.get(label) ?? 0) + row.messageCount);
  }

  const merged = Array.from(byLabel, ([label, messageCount]) => ({ label, messageCount })).sort(
    (a, b) => b.messageCount - a.messageCount,
  );

  return withShares(merged);
}
