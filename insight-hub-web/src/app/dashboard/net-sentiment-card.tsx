"use client";

import { useState } from "react";

import type { DailyNetSentiment } from "@/db/net-sentiment-score";
import type { NetSentimentPeakWithMessage } from "@/db/sentiment-timeline-peaks";

import { buildEvolutionPathPoints } from "./chart-geometry";

const CHART_WIDTH = 560;
const CHART_HEIGHT = 160;
const CHART_PADDING = 20;

export function NetSentimentCard({
  score,
  evolution,
  peaks,
  source,
  previousScore,
  previousDateFrom,
  previousDateTo,
}: {
  score: number | null;
  evolution: DailyNetSentiment[];
  peaks: NetSentimentPeakWithMessage[];
  source: "ai" | "csv_original";
  previousScore: number | null;
  previousDateFrom: string | null;
  previousDateTo: string | null;
}) {
  return (
    <div className="card">
      <span className="kicker">Sentiment</span>
      <h2>Score de sentiment net</h2>
      <p className="subtitle">
        (messages positifs − messages négatifs) / total des messages classés.
      </p>
      {source === "csv_original" && (
        <p className="provisional-notice">
          Score provisoire, basé sur le sentiment original du CSV (émotion brute), pas sur une
          classification IA — la classification IA n&apos;est pas encore activée.
        </p>
      )}
      <NetScoreValue score={score} />
      <NetScoreComparisonBadge
        score={score}
        previousScore={previousScore}
        previousDateFrom={previousDateFrom}
        previousDateTo={previousDateTo}
      />
      {evolution.length > 0 ? (
        <EvolutionChart evolution={evolution} peaks={peaks} />
      ) : (
        <p className="empty-state">Aucun message classé pour l&apos;instant.</p>
      )}
    </div>
  );
}

// Formate une date calendaire "YYYY-MM-DD" en UTC, cohérent avec la manière
// dont dateRangeCondition interprète déjà ces bornes (voir dashboard-filters.ts)
// — évite tout décalage d'un jour lié au fuseau horaire local de l'utilisateur.
function formatPeriodDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function formatPeriodRange(dateFrom: string, dateTo: string): string {
  return `${formatPeriodDate(dateFrom)} – ${formatPeriodDate(dateTo)}`;
}

// Comparaison temporelle du score net (voir la capacité
// net-sentiment-temporal-comparison) : restitution pure, aucun nouveau
// calcul, seulement la mise en forme de deux scores déjà produits par
// getNetSentimentScore (période courante et période précédente équivalente).
function NetScoreComparisonBadge({
  score,
  previousScore,
  previousDateFrom,
  previousDateTo,
}: {
  score: number | null;
  previousScore: number | null;
  previousDateFrom: string | null;
  previousDateTo: string | null;
}) {
  // Score courant indisponible : l'état vide déjà affiché pour le KPI
  // suffit, un badge de comparaison serait redondant (voir design.md §5).
  if (score === null) return null;

  // Pas de filtre de période complet actif : la comparaison n'a pas de sens
  // (voir net-sentiment-temporal-comparison, Requirement: Comparison
  // Unavailable Without A Complete Period Filter).
  if (!previousDateFrom || !previousDateTo) {
    return (
      <p className="net-score-comparison net-score-comparison--hint">
        Sélectionnez une période pour comparer au score de la période précédente.
      </p>
    );
  }

  const rangeLabel = formatPeriodRange(previousDateFrom, previousDateTo);

  if (previousScore === null) {
    return (
      <p className="net-score-comparison net-score-comparison--unavailable">
        Comparaison indisponible : aucun message classé sur la période précédente ({rangeLabel}).
      </p>
    );
  }

  const delta = score - previousScore;
  const variant = delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "–";
  const formattedDelta = delta > 0 ? `+${delta}` : `${delta}`;

  return (
    <p className={`net-score-comparison net-score-comparison--${variant}`}>
      <span className="net-score-comparison__delta">
        <span aria-hidden="true">{arrow}</span> {formattedDelta} pts
      </span>{" "}
      <span className="net-score-comparison__caption">vs période précédente ({rangeLabel})</span>
    </p>
  );
}

function NetScoreValue({ score }: { score: number | null }) {
  if (score === null) {
    return <p className="empty-state">Score indisponible : aucun message classé pour l&apos;instant.</p>;
  }

  const variant = score > 0 ? "positive" : score < 0 ? "negative" : "";
  const formatted = score > 0 ? `+${score}` : `${score}`;

  return (
    <div className={`kpi-value ${variant ? `kpi-value--${variant}` : ""}`}>
      {formatted}
      <span className="kpi-unit">pts</span>
    </div>
  );
}

function formatScore(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function EvolutionChart({
  evolution,
  peaks,
}: {
  evolution: DailyNetSentiment[];
  peaks: NetSentimentPeakWithMessage[];
}) {
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const { points, path, zeroY } = buildEvolutionPathPoints(
    evolution,
    CHART_WIDTH,
    CHART_HEIGHT,
    CHART_PADDING,
  );

  const peakByDate = new Map(peaks.map((peak) => [peak.date, peak]));
  const activePeak = activeDate ? peakByDate.get(activeDate) ?? null : null;
  const activePoint = activeDate ? points.find((point) => point.date === activeDate) : undefined;

  const first = evolution[0];
  const last = evolution[evolution.length - 1];

  return (
    <div className="evolution-chart-wrap">
      <svg
        className="evolution-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`Évolution du score net du ${first.date} au ${last.date}`}
      >
        <line
          x1={CHART_PADDING}
          y1={zeroY}
          x2={CHART_WIDTH - CHART_PADDING}
          y2={zeroY}
          stroke="var(--color-border)"
          strokeDasharray="4 4"
        />
        <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth={2} />
        {points.map(({ x, y, date }) => {
          const peak = peakByDate.get(date);
          if (peak) return null;
          return <circle key={date} cx={x} cy={y} r={2.5} fill="var(--color-primary)" />;
        })}
        {points.map(({ x, y, date }) => {
          const peak = peakByDate.get(date);
          if (!peak) return null;
          const color = peak.direction === "positive" ? "var(--color-success)" : "var(--color-error)";
          return (
            <circle
              key={date}
              className="evolution-chart__peak"
              cx={x}
              cy={y}
              r={5}
              fill={color}
              stroke="var(--color-surface)"
              strokeWidth={1.5}
              tabIndex={0}
              role="button"
              aria-label={`Pic ${peak.direction === "positive" ? "positif" : "négatif"} le ${peak.date} : ${formatScore(peak.netScore)} pts`}
              onMouseEnter={() => setActiveDate(date)}
              onMouseLeave={() => setActiveDate((current) => (current === date ? null : current))}
              onFocus={() => setActiveDate(date)}
              onBlur={() => setActiveDate((current) => (current === date ? null : current))}
              onClick={() => setActiveDate((current) => (current === date ? null : date))}
            />
          );
        })}
        <text x={CHART_PADDING} y={CHART_HEIGHT - 4}>
          {first.date}
        </text>
        <text x={CHART_WIDTH - CHART_PADDING} y={CHART_HEIGHT - 4} textAnchor="end">
          {last.date}
        </text>
      </svg>
      {activePeak && activePoint && (
        <PeakTooltip
          peak={activePeak}
          leftPercent={(activePoint.x / CHART_WIDTH) * 100}
          topPercent={(activePoint.y / CHART_HEIGHT) * 100}
        />
      )}
    </div>
  );
}

function PeakTooltip({
  peak,
  leftPercent,
  topPercent,
}: {
  peak: NetSentimentPeakWithMessage;
  leftPercent: number;
  topPercent: number;
}) {
  const directionLabel = peak.direction === "positive" ? "Pic positif" : "Pic négatif";
  const deviationLabel = `${formatScore(peak.deviationFromMean)} pts par rapport à la moyenne de la période`;

  // Le conteneur .card coupe tout débordement (overflow: hidden) : on évite
  // que la tooltip sorte du cadre en la recentrant horizontalement et en
  // la basculant sous le marqueur quand celui-ci est trop haut dans le graphique.
  const clampedLeftPercent = Math.min(88, Math.max(12, leftPercent));
  const showBelow = topPercent < 35;

  return (
    <div
      className={`evolution-chart__tooltip evolution-chart__tooltip--${peak.direction} ${
        showBelow ? "evolution-chart__tooltip--below" : ""
      }`}
      style={{ left: `${clampedLeftPercent}%`, top: `${topPercent}%` }}
    >
      <p className="evolution-chart__tooltip-title">
        {directionLabel} · {peak.date}
      </p>
      <p className="evolution-chart__tooltip-score">
        {formatScore(peak.netScore)} pts <span>({deviationLabel})</span>
      </p>
      {peak.representativeMessage ? (
        <p className="evolution-chart__tooltip-message">
          « {peak.representativeMessage.text} »
          <span>
            {" "}
            — {peak.representativeMessage.user} · {peak.representativeMessage.platform}
          </span>
        </p>
      ) : (
        <p className="evolution-chart__tooltip-message">Aucun message représentatif disponible.</p>
      )}
    </div>
  );
}
