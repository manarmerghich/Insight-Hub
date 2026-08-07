"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { importRuns } from "@/db/schema";
import { getCurrentVisitorId } from "@/lib/visitor";

type SubmitResult = { runId: number; error?: never } | { runId?: never; error: string };

async function callPipelineImport(input: {
  keyword: string;
  filename: string;
  file?: File;
  blobUrl?: string;
}): Promise<SubmitResult> {
  const visitorId = await getCurrentVisitorId();

  const body = new FormData();
  body.append("keyword", input.keyword);
  body.append("filename", input.filename);
  body.append("visitor_id", visitorId);
  if (input.file) body.append("file", input.file);
  if (input.blobUrl) body.append("blob_url", input.blobUrl);

  let response: Response;
  try {
    response = await fetch(`${process.env.PIPELINE_SERVICE_URL}/api/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.PIPELINE_AUTH_TOKEN}` },
      body,
    });
  } catch {
    return { error: "Le service d'import est injoignable. Réessayez plus tard." };
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      error: data?.detail ?? `Le service d'import a refusé la requête (${response.status}).`,
    };
  }

  return { runId: data.run_id };
}

export async function submitDirectImport(formData: FormData): Promise<SubmitResult> {
  const keyword = formData.get("keyword");
  const filename = formData.get("filename");
  const file = formData.get("file");

  if (typeof keyword !== "string" || !keyword.trim()) {
    return { error: "Le mot-clé est obligatoire." };
  }
  if (!(file instanceof File) || typeof filename !== "string" || !filename) {
    return { error: "Un fichier CSV est obligatoire." };
  }

  return callPipelineImport({ keyword: keyword.trim(), filename, file });
}

export async function submitBlobImport(input: {
  keyword: string;
  filename: string;
  blobUrl: string;
}): Promise<SubmitResult> {
  if (!input.keyword.trim()) {
    return { error: "Le mot-clé est obligatoire." };
  }

  return callPipelineImport({
    keyword: input.keyword.trim(),
    filename: input.filename,
    blobUrl: input.blobUrl,
  });
}

export type RunStatus = {
  status: string;
  matchedCount: number | null;
  retainedCount: number | null;
  errorMessage: string | null;
};

export async function getRunStatus(runId: number): Promise<RunStatus | null> {
  const [run] = await db.select().from(importRuns).where(eq(importRuns.id, runId));
  if (!run) return null;

  return {
    status: run.status,
    matchedCount: run.matchedCount,
    retainedCount: run.retainedCount,
    errorMessage: run.errorMessage,
  };
}
