import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { importRuns, messages } from "@/db/schema";

// Mots-clés distincts ayant au moins un run avec au moins un message —
// même filtre "run avec messages" que getLatestImportRun
// (latest-import-run.ts), appliqué ici par mot-clé plutôt que globalement
// (voir design.md, Decision "Résolution du second run"). Scopé au visiteur
// courant (add-visitor-session-scoping) : un mot-clé importé par un autre
// visiteur ne doit jamais apparaître ici — voir keyword-comparison
// Requirement "Comparable Keyword Selection" (modifié).
export async function getComparableKeywords(
  excludeKeyword: string | null,
  visitorId: string,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ keyword: importRuns.keyword })
    .from(importRuns)
    .innerJoin(messages, eq(messages.runId, importRuns.id))
    .where(eq(importRuns.visitorId, visitorId));

  return sortComparableKeywords(
    rows.map((row) => row.keyword),
    excludeKeyword,
  );
}

// Extraite en fonction pure pour être testable sans base de données —
// déduplication et exclusion insensibles à la casse, tri alphabétique.
// Même approche que buildCountryDistribution (message-distribution.ts) :
// la logique d'agrégation/tri est séparée de la requête DB.
export function sortComparableKeywords(
  keywords: string[],
  excludeKeyword: string | null,
): string[] {
  const excludeNormalized = excludeKeyword?.trim().toLowerCase();
  const byNormalized = new Map<string, string>();

  for (const keyword of keywords) {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized || normalized === excludeNormalized) continue;
    if (!byNormalized.has(normalized)) byNormalized.set(normalized, keyword);
  }

  return Array.from(byNormalized.values()).sort((a, b) => a.localeCompare(b, "fr"));
}

export async function getLatestRunIdForKeyword(
  keyword: string,
  visitorId: string,
): Promise<number | null> {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return null;

  const rows = await db
    .selectDistinct({ id: importRuns.id })
    .from(importRuns)
    .innerJoin(messages, eq(messages.runId, importRuns.id))
    .where(and(eq(sql`lower(${importRuns.keyword})`, normalized), eq(importRuns.visitorId, visitorId)));

  return pickLatestRunId(rows.map((row) => row.id));
}

// Le run "le plus récent" est celui au plus grand id (serial, monotone
// avec l'insertion) parmi les runs du mot-clé ayant au moins un message —
// même convention que getLatestImportRun (latest-import-run.ts). Extraite
// en fonction pure pour rester testable sans base de données.
export function pickLatestRunId(runIds: number[]): number | null {
  if (runIds.length === 0) return null;
  return Math.max(...runIds);
}
