"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { DashboardFilterOptions } from "@/db/dashboard-filter-options";

export function FilterBar({ options }: { options: DashboardFilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hasActiveFilter = [
    "dateFrom",
    "dateTo",
    "platform",
    "country",
    "sentiment",
    "themeId",
  ].some((key) => Boolean(searchParams.get(key)));

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(params.size > 0 ? `${pathname}?${params}` : pathname);
  }

  return (
    <div className="filter-bar">
      <label className="filter-bar__field">
        Depuis
        <input
          type="date"
          value={searchParams.get("dateFrom") ?? ""}
          min={options.dateBounds?.min}
          max={options.dateBounds?.max}
          onChange={(event) => setParam("dateFrom", event.target.value)}
        />
      </label>
      <label className="filter-bar__field">
        Jusqu&apos;au
        <input
          type="date"
          value={searchParams.get("dateTo") ?? ""}
          min={options.dateBounds?.min}
          max={options.dateBounds?.max}
          onChange={(event) => setParam("dateTo", event.target.value)}
        />
      </label>
      <label className="filter-bar__field">
        Plateforme
        <select
          value={searchParams.get("platform") ?? ""}
          onChange={(event) => setParam("platform", event.target.value)}
        >
          <option value="">Toutes</option>
          {options.platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-bar__field">
        Pays
        <select
          value={searchParams.get("country") ?? ""}
          onChange={(event) => setParam("country", event.target.value)}
        >
          <option value="">Tous</option>
          {options.countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-bar__field">
        Sentiment
        <select
          value={searchParams.get("sentiment") ?? ""}
          onChange={(event) => setParam("sentiment", event.target.value)}
        >
          <option value="">Tous</option>
          {options.sentiments.map((sentiment) => (
            <option key={sentiment} value={sentiment}>
              {sentiment}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-bar__field">
        Thème
        <select
          value={searchParams.get("themeId") ?? ""}
          onChange={(event) => setParam("themeId", event.target.value)}
        >
          <option value="">Tous</option>
          {options.themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="filter-bar__reset"
        disabled={!hasActiveFilter}
        onClick={() => router.push(pathname)}
      >
        Réinitialiser
      </button>
    </div>
  );
}
