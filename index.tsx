import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Activity, Bell, BarChart3, Zap, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [session, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Voltiq</span>
          </div>
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Live energy insights
          </div>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-6xl">
            See every watt.
            <br />
            <span className="text-primary">Save every bill.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-muted-foreground">
            Voltiq monitors your home devices in real time, spots waste, and alerts
            you before your consumption spikes.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth"><Button size="lg">Get started free</Button></Link>
            <Link to="/auth"><Button size="lg" variant="outline">I have an account</Button></Link>
          </div>
        </section>

        <section className="grid gap-6 pb-24 md:grid-cols-3">
          {[
            { icon: Activity, title: "Live monitoring", body: "Second-by-second power draw across all your devices." },
            { icon: BarChart3, title: "Rich analytics", body: "Trends, hourly heatmaps, and per-device breakdowns." },
            { icon: Bell, title: "Threshold alerts", body: "Email notifications when usage crosses your limits." },
            { icon: ShieldCheck, title: "Role-based access", body: "Admins manage the fleet; users own their devices." },
            { icon: Zap, title: "Smart recommendations", body: "AI-driven tips to cut standby and peak usage." },
            { icon: BarChart3, title: "Exportable reports", body: "Download CSV reports for any period." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
