import type { Metadata } from "next";
import AgencyShell from "@/components/agency/AgencyShell";

export const metadata: Metadata = {
  title: "Montview — Agency Admin",
};

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return <AgencyShell>{children}</AgencyShell>;
}
