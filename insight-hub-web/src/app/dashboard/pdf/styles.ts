import { StyleSheet } from "@react-pdf/renderer";

// Palette reprise de globals.css (`:root`) pour un rendu PDF visuellement
// cohérent avec le dashboard — voir pdf-export, design.md, § "Composants
// PDF dédiés, un module pdf/ séparé des composants dashboard".
export const COLORS = {
  primary: "#2563eb",
  secondary: "#7c3aed",
  success: "#22c55e",
  successText: "#15803d",
  successBg: "#f0fdf4",
  error: "#ef4444",
  errorText: "#b91c1c",
  errorBg: "#fef2f2",
  text: "#0f172a",
  textMuted: "#475569",
  border: "#e2e8f0",
  bg: "#f8fafc",
  surface: "#ffffff",
};

export const SENTIMENT_LABELS: Record<string, string> = {
  positif: "Positif",
  négatif: "Négatif",
  neutre: "Neutre",
};

export const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
  section: {
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderBottomStyle: "solid",
  },
  sectionLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  kicker: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: COLORS.secondary,
    marginBottom: 4,
  },
  heading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: COLORS.text,
  },
  emptyState: {
    fontSize: 9,
    color: COLORS.textMuted,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 4,
  },
  notice: {
    fontSize: 8.5,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  kpiValuePositive: {
    color: COLORS.successText,
  },
  kpiValueNegative: {
    color: COLORS.errorText,
  },
  chartAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  chartAxisLabel: {
    fontSize: 7.5,
    color: COLORS.textMuted,
  },
  distributionColumns: {
    flexDirection: "row",
    gap: 18,
  },
  distributionColumn: {
    flex: 1,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  barRowLabel: {
    width: 70,
    fontSize: 8,
    color: COLORS.text,
  },
  barRowTrack: {
    flexGrow: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.bg,
  },
  barRowFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  barRowValue: {
    width: 28,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textMuted,
    textAlign: "right",
  },
  messageRow: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderBottomStyle: "solid",
  },
  messageRowHeader: {
    fontSize: 8,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  messageRowText: {
    fontSize: 9.5,
    lineHeight: 1.4,
    color: COLORS.text,
  },
});
