import { describe, expect, it } from "vitest";

import {
  isResultCapExceeded,
  MESSAGE_SEARCH_RESULT_CAP,
  resolveSortMode,
} from "@/db/message-search";
import type { DashboardFilters } from "@/db/dashboard-filters";

describe("resolveSortMode", () => {
  it("trie par pertinence quand une recherche textuelle est active", () => {
    expect(resolveSortMode({ query: "incident" })).toBe("relevance");
  });

  it("trie par date quand aucune recherche textuelle n'est active, même avec favoritesOnly", () => {
    expect(resolveSortMode({})).toBe("recency");
    expect(resolveSortMode({ favoritesOnly: true })).toBe("recency");
  });

  it("trie par date quand la recherche ne contient que des espaces", () => {
    const filters: DashboardFilters = { query: "   " };
    expect(resolveSortMode(filters)).toBe("recency");
  });
});

describe("isResultCapExceeded", () => {
  it("n'est pas dépassé à exactement 50 correspondances", () => {
    expect(isResultCapExceeded(MESSAGE_SEARCH_RESULT_CAP)).toBe(false);
  });

  it("est dépassé au-delà de 50 correspondances", () => {
    expect(isResultCapExceeded(MESSAGE_SEARCH_RESULT_CAP + 1)).toBe(true);
  });

  it("n'est pas dépassé quand il n'y a aucune correspondance", () => {
    expect(isResultCapExceeded(0)).toBe(false);
  });
});
