import { NextResponse } from "next/server";

import { getThemeRanking } from "@/db/theme-ranking";

export async function GET(): Promise<NextResponse> {
  const themes = await getThemeRanking();
  return NextResponse.json({ themes });
}
