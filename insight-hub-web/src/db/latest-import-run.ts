import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { importRuns, messages } from "@/db/schema";

export type LatestImportRun = {
  id: number;
  keyword: string;
  sourceFilename: string;
  startedAt: Date;
};

// "Latest" means the most recent run that actually has messages attached —
// a run that matched nothing or only duplicates (retainedCount 0) isn't a
// meaningful default scope for the dashboard, so it's skipped in favor of
// the last run that produced something to show. Ordered by id (serial,
// monotonic with insertion) rather than startedAt to avoid ties.
// Scopé au visiteur courant (voir add-visitor-session-scoping) : deux
// visiteurs distincts ne doivent jamais partager le même "dernier run".
export async function getLatestImportRun(visitorId: string): Promise<LatestImportRun | null> {
  const [run] = await db
    .select({
      id: importRuns.id,
      keyword: importRuns.keyword,
      sourceFilename: importRuns.sourceFilename,
      startedAt: importRuns.startedAt,
    })
    .from(importRuns)
    .innerJoin(messages, eq(messages.runId, importRuns.id))
    .where(eq(importRuns.visitorId, visitorId))
    .groupBy(importRuns.id)
    .orderBy(desc(importRuns.id))
    .limit(1);

  return run ?? null;
}
