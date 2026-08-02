"use client";

import { useEffect, useState } from "react";

import { getRunStatus, type RunStatus as RunStatusData } from "./actions";

const POLL_INTERVAL_MS = 2000;

export function RunStatus({ runId }: { runId: number }) {
  const [run, setRun] = useState<RunStatusData | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const result = await getRunStatus(runId);
      if (cancelled || !result) return;

      setRun(result);

      if (result.status !== "completed" && result.status !== "error") {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runId]);

  const status = run?.status ?? "running";
  const variant = status === "completed" ? "completed" : status === "error" ? "error" : "running";

  return (
    <div className={`status status--${variant}`} role="status">
      {status === "completed" && <p>{formatCompletionMessage(run)}</p>}
      {status === "error" && <p>Échec de l&apos;import : {run?.errorMessage}</p>}
      {status !== "completed" && status !== "error" && <p>Import en cours…</p>}
    </div>
  );
}

function formatCompletionMessage(run: RunStatusData | null): string {
  const matchedCount = run?.matchedCount;
  const retainedCount = run?.retainedCount ?? 0;

  // matchedCount is only unavailable for runs recorded before this field existed.
  if (matchedCount == null) {
    return `Import terminé : ${retainedCount} message(s) retenu(s).`;
  }
  if (matchedCount === 0) {
    return "Import terminé : aucun message ne correspond à ce mot-clé.";
  }
  if (retainedCount === matchedCount) {
    return `Import terminé : ${retainedCount} message(s) retenu(s).`;
  }
  if (retainedCount === 0) {
    return (
      `Import terminé : ${matchedCount} message(s) correspondant au mot-clé, ` +
      "mais déjà tous importés précédemment (0 nouveau)."
    );
  }
  return (
    `Import terminé : ${matchedCount} message(s) correspondant au mot-clé, ` +
    `dont ${retainedCount} nouveau(x) — les autres étaient déjà importés.`
  );
}
