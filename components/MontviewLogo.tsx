// Montview mark — a clean filled mountain range with a rising sun ("mont" + "view").
// Reusable across the clipping app and the agency dashboard.
export default function MontviewLogo({
  size = 32,
  tile = true,
  fg = "#F5F0E6",
  bg = "#1B2740",
}: { size?: number; tile?: boolean; fg?: string; bg?: string }) {
  const mark = (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      {/* rising sun / viewpoint */}
      <circle cx="66" cy="33" r="11" fill={fg} opacity="0.9" />
      {/* mountain range forming a soft M silhouette */}
      <path d="M6 84 L33 40 L48 62 L66 32 L94 84 Z" fill={fg} />
      {/* front ridge for depth */}
      <path d="M6 84 L33 40 L44 56 L28 84 Z" fill={bg} opacity="0.22" />
    </svg>
  );
  if (!tile) return mark;
  return (
    <span
      style={{
        width: size + 12, height: size + 12, background: bg,
        borderRadius: 14, border: `1px solid ${fg}22`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {mark}
    </span>
  );
}
