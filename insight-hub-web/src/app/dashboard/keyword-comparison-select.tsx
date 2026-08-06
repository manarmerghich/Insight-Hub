"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function KeywordComparisonSelect({ comparableKeywords }: { comparableKeywords: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hasComparableKeywords = comparableKeywords.length > 0;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("compareKeyword", value);
    } else {
      params.delete("compareKeyword");
    }
    router.push(params.size > 0 ? `${pathname}?${params}` : pathname);
  }

  return (
    <div className="keyword-comparison-select">
      <label className="keyword-comparison-select__field">
        Comparer avec un second mot-clé
        <select
          value={searchParams.get("compareKeyword") ?? ""}
          disabled={!hasComparableKeywords}
          onChange={(event) => handleChange(event.target.value)}
        >
          <option value="">Aucune comparaison</option>
          {comparableKeywords.map((keyword) => (
            <option key={keyword} value={keyword}>
              {keyword}
            </option>
          ))}
        </select>
      </label>
      {!hasComparableKeywords && (
        <p className="empty-state empty-state--compact">
          Importez un second mot-clé pour activer la comparaison.
        </p>
      )}
    </div>
  );
}
