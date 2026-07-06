// Glass "coming soon" placeholder for agency tabs not yet built out.
export default function AgencyPlaceholder({ title, subtitle, note }: { title: string; subtitle: string; note?: string }) {
  return (
    <div>
      <h1 className="font-semibold tracking-tight" style={{ fontSize: 30, letterSpacing: "-0.02em", color: "#f5f5f7" }}>{title}</h1>
      <p className="mt-1.5 text-[15px]" style={{ color: "#86868b" }}>{subtitle}</p>

      <div
        className="mt-7 flex flex-col items-center justify-center text-center px-8 py-16"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "0.5px solid rgba(255,255,255,0.09)",
          borderRadius: 16,
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
        }}
      >
        <span className="text-[12px] font-medium px-3 py-1 rounded-full"
          style={{ background: "rgba(10,132,255,0.15)", color: "#0A84FF", border: "0.5px solid rgba(10,132,255,0.3)" }}>
          Coming soon
        </span>
        <p className="mt-4 text-[15px] max-w-md" style={{ color: "#86868b" }}>
          {note || "This section is scaffolded and ready. We'll build it out next."}
        </p>
      </div>
    </div>
  );
}
