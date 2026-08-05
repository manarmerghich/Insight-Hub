"use client";

import { useState } from "react";

import type { DailyNetSentiment } from "@/db/net-sentiment-score";
import type { NetSentimentPeakWithMessage } from "@/db/sentiment-timeline-peaks";

const CHART_WIDTH = 560;
const CHART_HEIGHT = 160;
const CHART_PADDING = 20;

export function NetSentimentCard({
  score,
  evolution,
  peaks,
  source,
}: {
  score: number | null;
  evolution: DailyNetSentiment[];
  peaks: NetSentimentPeakWithMessage[];
  source: "ai" | "csv_original";
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
      {evolution.length > 0 ? (
        <EvolutionChart evolution={evolution} peaks={peaks} />
      ) : (
        <p className="empty-state">Aucun message classé pour l&apos;instant.</p>
      )}
    </div>
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

  const innerWidth = CHART_WIDTH - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const zeroY = CHART_PADDING + innerHeight / 2;

  const points = evolution.map((point, index) => {
    const x =
      evolution.length === 1
        ? CHART_PADDING + innerWidth / 2
        : CHART_PADDING + (index / (evolution.length - 1)) * innerWidth;
    const y = CHART_PADDING + innerHeight / 2 - (point.netScore / 100) * (innerHeight / 2);
    return { x, y, point };
  });

  const peakByDate = new Map(peaks.map((peak) => [peak.date, peak]));
  const activePeak = activeDate ? peakByDate.get(activeDate) ?? null : null;
  const activePoint = activeDate ? points.find(({ point }) => point.date === activeDate) : undefined;

  const path = points.map((p, index) => `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
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
        {points.map(({ x, y, point }) => {
          const peak = peakByDate.get(point.date);
          if (peak) return null;
          return <circle key={point.date} cx={x} cy={y} r={2.5} fill="var(--color-primary)" />;
        })}
        {points.map(({ x, y, point }) => {
          const peak = peakByDate.get(point.date);
          if (!peak) return null;
          const color = peak.direction === "positive" ? "var(--color-success)" : "var(--color-error)";
          return (
            <circle
              key={point.date}
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
              onMouseEnter={() => setActiveDate(point.date)}
              onMouseLeave={() => setActiveDate((current) => (current === point.date ? null : current))}
              onFocus={() => setActiveDate(point.date)}
              onBlur={() => setActiveDate((current) => (current === point.date ? null : current))}
              onClick={() => setActiveDate((current) => (current === point.date ? null : point.date))}
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
