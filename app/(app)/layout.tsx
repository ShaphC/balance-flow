import { FloatingNav } from "@/components/navigation/floating-nav";
import { ThemeProvider } from "@/components/theme-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="pb-24">{children}</div>

        <FloatingNav />
      </div>
    </ThemeProvider>
  );
}
