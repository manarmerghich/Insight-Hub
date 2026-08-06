"use client";

import { useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

// Import de type uniquement (effacé à la compilation) : ce composant client
// ne doit jamais tirer avec lui le module message-distribution.ts, qui
// importe le client de base de données (@/db/client) au niveau module — un
// import de valeur ferait crasher le bundle navigateur (neon() sans
// DATABASE_URL côté client).
import type { CountryDistributionEntry } from "@/db/message-distribution";
import { resolveMapCountryName } from "@/db/country-geo-mapping";

// Fond de carte servi en asset statique (voir design.md décision 1) : chargé
// et mis en cache par le navigateur au premier affichage, pas embarqué dans
// le bundle JS.
const GEO_URL = "/geo/world-countries-50m.json";

type MapMetric = "volume" | "sentiment";

// Bornes d'intensité des rampes de couleur : jamais 0 (un pays avec très peu
// de volume resterait invisible) ni 1 (garde une marge avant le "pas de
// donnée"), voir design.md décision 4.
const RAMP_MIN_ALPHA = 0.16;
const RAMP_MAX_ALPHA = 0.92;

// Couleurs reprises telles quelles de globals.css (--color-primary,
// --color-success, --color-error) exprimées en rgb() pour pouvoir moduler
// l'opacité selon l'intensité — la palette n'introduit aucune nouvelle
// couleur, voir design.md décision 4 et tasks.md 4.4.
const PRIMARY_RGB = "37, 99, 235";
const SUCCESS_RGB = "34, 197, 94";
const ERROR_RGB = "239, 68, 68";

// Un pays représenté sur le fond de carte mais absent du classement filtré
// (aucun message), ou sans score net pour la vue sentiment, utilise cette
// teinte neutre plutôt qu'une extrémité de rampe — reprend --color-bg,
// distincte des deux rampes (voir Requirement: Country Code Mapping For Map
// Rendering).
const NO_DATA_FILL = "var(--color-bg)";
// Un pays avec des messages classés dont le score net vaut exactement 0
// reste une donnée réelle (contrairement à "pas de donnée") : --color-border
// le distingue visuellement de NO_DATA_FILL tout en restant neutre.
const SENTIMENT_ZERO_FILL = "var(--color-border)";

function volumeFillColor(share: number, maxShare: number): string {
  if (maxShare <= 0 || share <= 0) return NO_DATA_FILL;
  const ratio = Math.min(share / maxShare, 1);
  const alpha = RAMP_MIN_ALPHA + (RAMP_MAX_ALPHA - RAMP_MIN_ALPHA) * ratio;
  return `rgba(${PRIMARY_RGB}, ${alpha.toFixed(3)})`;
}

function sentimentFillColor(netScore: number | null): string {
  if (netScore === null) return NO_DATA_FILL;
  const clamped = Math.max(-100, Math.min(100, netScore));
  if (clamped === 0) return SENTIMENT_ZERO_FILL;

  const ratio = Math.abs(clamped) / 100;
  const alpha = RAMP_MIN_ALPHA + (RAMP_MAX_ALPHA - RAMP_MIN_ALPHA) * ratio;
  const rgb = clamped > 0 ? SUCCESS_RGB : ERROR_RGB;
  return `rgba(${rgb}, ${alpha.toFixed(3)})`;
}

function formatScore(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

type HoveredCountry = {
  label: string;
  entry: CountryDistributionEntry;
  leftPercent: number;
  topPercent: number;
};

export function CountryMapCard({ entries }: { entries: CountryDistributionEntry[] }) {
  const [metric, setMetric] = useState<MapMetric>("volume");
  const [hovered, setHovered] = useState<HoveredCountry | null>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  const hasData = entries.length > 0;

  // Table de correspondance nom topojson -> entrée du classement, construite
  // une fois par changement de données (voir Requirement: Country Code
  // Mapping For Map Rendering) : "Non renseigné" et les pays non reconnus
  // par resolveMapCountryName retournent null et n'y figurent donc jamais,
  // ils restent uniquement dans le classement sous la carte.
  const byMapName = useMemo(() => {
    const map = new Map<string, CountryDistributionEntry>();
    for (const entry of entries) {
      const mapName = resolveMapCountryName(entry.label);
      if (mapName) map.set(mapName, entry);
    }
    return map;
  }, [entries]);

  const maxShare = useMemo(
    () => entries.reduce((max, entry) => Math.max(max, entry.share), 0),
    [entries],
  );

  function handleMouseEnter(event: React.MouseEvent<SVGPathElement>, name: string, entry: CountryDistributionEntry) {
    const wrap = mapWrapRef.current;
    if (!wrap) return;

    const pathRect = event.currentTarget.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const leftPercent = ((pathRect.left + pathRect.width / 2 - wrapRect.left) / wrapRect.width) * 100;
    const topPercent = ((pathRect.top + pathRect.height / 2 - wrapRect.top) / wrapRect.height) * 100;

    setHovered({ label: name, entry, leftPercent, topPercent });
  }

  function clearHovered(name: string) {
    setHovered((current) => (current?.label === name ? null : current));
  }

  return (
    <div className="card">
      <span className="kicker">Répartition</span>
      <h2>Messages par pays</h2>
      {hasData ? (
        <>
          <div className="map-metric-toggle" role="group" aria-label="Métrique de coloration de la carte">
            <button
              type="button"
              className={`map-metric-toggle__button ${metric === "volume" ? "map-metric-toggle__button--active" : ""}`}
              aria-pressed={metric === "volume"}
              onClick={() => setMetric("volume")}
            >
              Volume
            </button>
            <button
              type="button"
              className={`map-metric-toggle__button ${metric === "sentiment" ? "map-metric-toggle__button--active" : ""}`}
              aria-pressed={metric === "sentiment"}
              onClick={() => setMetric("sentiment")}
            >
              Sentiment net
            </button>
          </div>
          <div className="country-map-wrap" ref={mapWrapRef}>
            <ComposableMap
              className="country-map"
              projection="geoEqualEarth"
              width={800}
              height={420}
              role="img"
              aria-label={
                metric === "volume"
                  ? "Carte du monde colorée par volume de messages par pays"
                  : "Carte du monde colorée par score de sentiment net par pays"
              }
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const name = geo.properties.name as string;
                    const entry = byMapName.get(name) ?? null;
                    const fill =
                      metric === "volume"
                        ? volumeFillColor(entry?.share ?? 0, maxShare)
                        : sentimentFillColor(entry?.netScore ?? null);

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="var(--color-surface)"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", cursor: entry ? "pointer" : "default" },
                          pressed: { outline: "none" },
                        }}
                        onMouseEnter={entry ? (event) => handleMouseEnter(event, name, entry) : undefined}
                        onMouseLeave={entry ? () => clearHovered(name) : undefined}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
            {hovered && <MapTooltip hovered={hovered} metric={metric} />}
          </div>
          <MapLegend metric={metric} />
          <CountryRanking entries={entries} />
        </>
      ) : (
        <p className="empty-state">Aucun message importé pour l&apos;instant.</p>
      )}
    </div>
  );
}

function MapTooltip({ hovered, metric }: { hovered: HoveredCountry; metric: MapMetric }) {
  const { entry, leftPercent, topPercent } = hovered;
  const clampedLeftPercent = Math.min(88, Math.max(12, leftPercent));
  const showBelow = topPercent < 30;

  return (
    <div
      className={`country-map__tooltip ${showBelow ? "country-map__tooltip--below" : ""}`}
      style={{ left: `${clampedLeftPercent}%`, top: `${topPercent}%` }}
    >
      <p className="country-map__tooltip-title">{entry.label}</p>
      <p className="country-map__tooltip-row">
        {entry.messageCount} message{entry.messageCount > 1 ? "s" : ""}
        <span> ({Math.round(entry.share * 100)}%)</span>
      </p>
      <p className="country-map__tooltip-row">
        {entry.netScore !== null ? (
          <>Score net : {formatScore(entry.netScore)} pts</>
        ) : (
          "Score net indisponible : aucun message classé"
        )}
      </p>
      {metric === "sentiment" && entry.netScore === null && (
        <p className="country-map__tooltip-row country-map__tooltip-row--muted">
          Colorié comme &laquo; pas de donnée &raquo; sur cette vue.
        </p>
      )}
    </div>
  );
}

function MapLegend({ metric }: { metric: MapMetric }) {
  if (metric === "volume") {
    return (
      <div className="map-legend">
        <span className="map-legend__swatch map-legend__swatch--no-data" />
        <span>Aucun message</span>
        <span className="map-legend__ramp map-legend__ramp--volume" />
        <span>Volume croissant</span>
      </div>
    );
  }

  return (
    <div className="map-legend">
      <span className="map-legend__swatch map-legend__swatch--negative" />
      <span>Négatif</span>
      <span className="map-legend__swatch map-legend__swatch--zero" />
      <span>Neutre</span>
      <span className="map-legend__swatch map-legend__swatch--positive" />
      <span>Positif</span>
    </div>
  );
}

function CountryRanking({ entries }: { entries: CountryDistributionEntry[] }) {
  return (
    <div className="bar-list">
      {entries.map((entry) => (
        <div className="bar-row" key={entry.label}>
          <span className="bar-row__label" title={entry.label}>
            {entry.label}
          </span>
          <span className="bar-row__track">
            <span
              className="bar-row__fill"
              style={{ width: `${Math.max(entry.share * 100, 2)}%` }}
            />
          </span>
          <span className="bar-row__value">{entry.messageCount}</span>
        </div>
      ))}
    </div>
  );
}
