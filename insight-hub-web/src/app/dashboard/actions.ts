"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { messages } from "@/db/schema";

export async function toggleMessageFavorite(messageId: number, next: boolean): Promise<boolean> {
  await db.update(messages).set({ isFavorite: next }).where(eq(messages.id, messageId));
  return next;
}
