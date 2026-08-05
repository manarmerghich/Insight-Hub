import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { messages, themes } from "@/db/schema";
import { dashboardFilterConditions, type DashboardFilters } from "@/db/dashboard-filters";

export type ThemeRankingEntry = {
  themeId: number;
  label: string;
  messageCount: number;
  share: number;
};

export async function getThemeRanking(
  runId: number | null,
  filters: DashboardFilters,
): Promise<ThemeRankingEntry[]> {
  if (runId === null) return [];

  const rows = await db
    .select({
      themeId: themes.id,
      label: themes.label,
      messageCount: count(messages.id),
    })
    .from(themes)
    .leftJoin(
      messages,
      and(
        eq(messages.themeId, themes.id),
        eq(messages.themeStatus, "completed"),
        eq(messages.runId, runId),
        ...dashboardFilterConditions(filters, "ai", { includeTheme: false }),
      ),
    )
    .groupBy(themes.id, themes.label)
    .orderBy(desc(count(messages.id)));

  const total = rows.reduce((sum, row) => sum + row.messageCount, 0);

  return rows.map((row) => ({
    ...row,
    share: total > 0 ? row.messageCount / total : 0,
  }));
}
