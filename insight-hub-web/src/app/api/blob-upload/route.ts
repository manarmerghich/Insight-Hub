import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["text/csv", "application/vnd.ms-excel", "text/plain"],
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // No-op: le run est déclenché explicitement par le client une fois
        // l'URL Blob connue (voir submitBlobImport), pas depuis ce callback.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
