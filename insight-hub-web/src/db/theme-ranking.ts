import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { messages, themes } from "@/db/schema";

export type ThemeRankingEntry = {
  themeId: number;
  label: string;
  messageCount: number;
  share: number;
};

export async function getThemeRanking(): Promise<ThemeRankingEntry[]> {
  const rows = await db
    .select({
      themeId: themes.id,
      label: themes.label,
      messageCount: count(messages.id),
    })
    .from(themes)
    .leftJoin(
      messages,
      and(eq(messages.themeId, themes.id), eq(messages.themeStatus, "completed")),
    )
    .groupBy(themes.id, themes.label)
    .orderBy(desc(count(messages.id)));

  const total = rows.reduce((sum, row) => sum + row.messageCount, 0);

  return rows.map((row) => ({
    ...row,
    share: total > 0 ? row.messageCount / total : 0,
  }));
}
