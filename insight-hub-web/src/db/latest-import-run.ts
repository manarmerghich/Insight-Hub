import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { importRuns } from "@/db/schema";
import { getLatestRunIdForKeyword } from "@/db/keyword-comparison";

export type LatestImportRun = {
  id: number;
  keyword: string;
  sourceFilename: string;
  startedAt: Date;
};

type RunCandidate = {
  id: number;
  keyword: string;
  sourceFilename: string;
  startedAt: Date;
};

// "Latest" suit le dernier mot-clé recherché, pas le dernier run ayant
// inséré de nouveaux messages : un réimport d'un mot-clé déjà utilisé peut
// dédupliquer à zéro message NOUVEAU (tout est déjà en base, rattaché à un
// run antérieur du même mot-clé) sans que ça ne signifie "reviens à un
// autre mot-clé". On part donc de l'ordre des recherches (par id, serial et
// monotone avec l'insertion), dédupliqué par mot-clé, et pour chacun on
// résout via getLatestRunIdForKeyword (keyword-comparison.ts) le run — pas
// forcément le plus récent — qui porte réellement les messages de ce
// mot-clé. On ne retombe sur le mot-clé recherché juste avant que si le
// mot-clé courant n'a jamais eu le moindre message en base (ex. import qui
// n'a jamais rien matché).
// Scopé au visiteur courant (voir add-visitor-session-scoping) : deux
// visiteurs distincts ne doivent jamais partager le même "dernier run".
export async function getLatestImportRun(visitorId: string): Promise<LatestImportRun | null> {
  const runs = await db
    .select({
      id: importRuns.id,
      keyword: importRuns.keyword,
      sourceFilename: importRuns.sourceFilename,
      startedAt: importRuns.startedAt,
    })
    .from(importRuns)
    .where(eq(importRuns.visitorId, visitorId))
    .orderBy(desc(importRuns.id));

  for (const candidate of distinctKeywordCandidates(runs)) {
    const runIdWithMessages = await getLatestRunIdForKeyword(candidate.keyword, visitorId);
    if (runIdWithMessages !== null) {
      return {
        id: runIdWithMessages,
        keyword: candidate.keyword,
        sourceFilename: candidate.sourceFilename,
        startedAt: candidate.startedAt,
      };
    }
  }

  return null;
}

// Ne garde que la recherche la plus récente de chaque mot-clé (comparaison
// insensible à la casse, comme getLatestRunIdForKeyword), dans l'ordre où
// les mots-clés ont été recherchés en dernier (runs déjà triés par id
// desc). Extraite en fonction pure pour être testable sans base de données.
export function distinctKeywordCandidates(runs: RunCandidate[]): RunCandidate[] {
  const seen = new Set<string>();
  const result: RunCandidate[] = [];

  for (const run of runs) {
    const normalized = run.keyword.trim().toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(run);
  }

  return result;
}
