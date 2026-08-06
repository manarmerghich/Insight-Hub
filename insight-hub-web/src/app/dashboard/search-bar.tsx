"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 400;

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function pushParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(params.size > 0 ? `${pathname}?${params}` : pathname);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParam("q", value), DEBOUNCE_MS);
  }

  return (
    <div className="search-bar">
      <label className="search-bar__field">
        Rechercher dans les messages
        <input
          type="text"
          value={query}
          placeholder="Ex. livraison, service client…"
          onChange={(event) => handleQueryChange(event.target.value)}
        />
      </label>
      <label className="search-bar__checkbox">
        <input
          type="checkbox"
          checked={searchParams.get("favorisUniquement") === "1"}
          onChange={(event) => pushParam("favorisUniquement", event.target.checked ? "1" : "")}
        />
        Favoris uniquement
      </label>
    </div>
  );
}
