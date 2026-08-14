import { FloatingNav } from "@/components/navigation/floating-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pb-24">{children}</div>

      <FloatingNav />
    </div>
  );
}
