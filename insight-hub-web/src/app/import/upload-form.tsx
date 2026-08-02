"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState, type FormEvent } from "react";

import { submitBlobImport, submitDirectImport } from "./actions";
import { RunStatus } from "./run-status";

const BLOB_THRESHOLD_BYTES = 4.5 * 1024 * 1024;

export function UploadForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRunId(null);

    const trimmedKeyword = keyword.trim();
    const file = fileInputRef.current?.files?.[0];

    if (!trimmedKeyword) {
      setError("Le mot-clé est obligatoire.");
      return;
    }
    if (!file) {
      setError("Un fichier CSV est obligatoire.");
      return;
    }

    setSubmitting(true);
    try {
      const result =
        file.size >= BLOB_THRESHOLD_BYTES
          ? await submitViaBlob(trimmedKeyword, file)
          : await submitDirectly(trimmedKeyword, file);

      if (result.error) {
        setError(result.error);
      } else if (result.runId) {
        setRunId(result.runId);
      }
    } catch {
      setError("La soumission a échoué : le service d'import est injoignable.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDirectly(trimmedKeyword: string, file: File) {
    const formData = new FormData();
    formData.append("keyword", trimmedKeyword);
    formData.append("filename", file.name);
    formData.append("file", file);
    return submitDirectImport(formData);
  }

  async function submitViaBlob(trimmedKeyword: string, file: File) {
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/blob-upload",
    });
    return submitBlobImport({ keyword: trimmedKeyword, filename: file.name, blobUrl: blob.url });
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label>
          Mot-clé
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={submitting}
          />
        </label>
        <label>
          Fichier CSV
          <input type="file" accept=".csv,text/csv" ref={fileInputRef} disabled={submitting} />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Envoi en cours…" : "Lancer l'import"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {runId !== null && <RunStatus runId={runId} />}
    </div>
  );
}
