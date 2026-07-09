import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, DollarSign, Gauge, TrendingDown, Zap } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureSeed, pushLiveReading, type Device, type Reading } from "@/lib/energy";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const RATE = 0.15; // $/kWh

function DashboardPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await ensureSeed(user.id);
      const { data: d } = await supabase.from("devices").select("*").order("name");
      const { data: r } = await supabase.from("energy_readings").select("*")
        .gte("recorded_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
        .order("recorded_at", { ascending: true });
      setDevices((d as Device[]) ?? []);
      setReadings((r as Reading[]) ?? []);
    })();
  }, [user?.id, tick]);

  // Live tick: every 15s push a synthetic reading for each device
  useEffect(() => {
    if (!user || devices.length === 0) return;
    const id = setInterval(async () => {
      for (const d of devices) {
        const last = readings.filter((r) => r.device_id === d.id).at(-1);
        await pushLiveReading(user.id, d, last?.energy_kwh ?? 0);
      }
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(id);
  }, [user?.id, devices.length]);

  const latestByDevice = useMemo(() => {
    const map = new Map<string, Reading>();
    for (const r of readings) map.set(r.device_id, r);
    return map;
  }, [readings]);

  const livePower = useMemo(() => Array.from(latestByDevice.values()).reduce((s, r) => s + r.power_w, 0), [latestByDevice]);
  const totalKwh24 = useMemo(() => {
    const since = Date.now() - 24 * 3600 * 1000;
    const perDevice = new Map<string, { first?: number; last?: number }>();
    for (const r of readings) {
      if (new Date(r.recorded_at).getTime() < since) continue;
      const entry = perDevice.get(r.device_id) ?? {};
      if (entry.first === undefined) entry.first = r.energy_kwh;
      entry.last = r.energy_kwh;
      perDevice.set(r.device_id, entry);
    }
    let total = 0;
    for (const v of perDevice.values()) total += Math.max(0, (v.last ?? 0) - (v.first ?? 0));
    return total;
  }, [readings]);

  const hourlyTotals = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const r of readings) {
      const d = new Date(r.recorded_at);
      const key = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}h`;
      buckets.set(key, (buckets.get(key) ?? 0) + r.power_w);
    }
    return Array.from(buckets.entries()).slice(-48).map(([label, w]) => ({ label, kw: Math.round(w) / 1000 }));
  }, [readings]);

  const deviceMix = useMemo(() => {
    return devices.map((d) => {
      const rs = readings.filter((r) => r.device_id === d.id);
      const kwh = rs.length ? Math.max(0, (rs.at(-1)!.energy_kwh) - (rs[0]!.energy_kwh)) : 0;
      return { name: d.name, value: Math.round(kwh * 10) / 10 };
    }).filter((x) => x.value > 0);
  }, [devices, readings]);

  const stats = [
    { label: "Live draw", value: `${(livePower / 1000).toFixed(2)} kW`, icon: Zap, hint: `${devices.length} devices` },
    { label: "Today's usage", value: `${totalKwh24.toFixed(1)} kWh`, icon: Activity, hint: "Last 24h" },
    { label: "Estimated cost", value: `$${(totalKwh24 * RATE).toFixed(2)}`, icon: DollarSign, hint: `@ $${RATE}/kWh` },
    { label: "Avg. voltage", value: `${(Array.from(latestByDevice.values()).reduce((s, r) => s + (r.voltage_v ?? 0), 0) / (latestByDevice.size || 1)).toFixed(0)} V`, icon: Gauge, hint: "Live" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live overview — updates every 15 seconds.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Live
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</span>
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 text-2xl font-semibold">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Power draw (last 48h)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyTotals}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickMargin={8} minTickGap={30} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} unit=" kW" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="kw" stroke="var(--chart-1)" fill="url(#g)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Usage by device (7d)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={deviceMix} dataKey="value" nameKey="name" innerRadius={45} outerRadius={90} paddingAngle={3}>
                  {deviceMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v: number) => `${v} kWh`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Live devices</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {devices.map((d) => {
              const r = latestByDevice.get(d.id);
              const pct = r ? Math.min(100, (r.power_w / (d.rated_power_w || 1)) * 100) : 0;
              return (
                <div key={d.id} className="rounded-lg border border-border bg-background/40 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.location} · {d.type}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{r ? `${(r.power_w).toFixed(0)} W` : "—"}</div>
                      <div className="text-xs text-muted-foreground">of {d.rated_power_w} W</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-primary" /> Recommendations</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {deviceMix.slice().sort((a, b) => b.value - a.value).slice(0, 3).map((d) => (
            <div key={d.name} className="rounded-lg border border-border bg-background/40 p-3">
              <span className="font-medium">{d.name}</span> is your top consumer at{" "}
              <span className="text-primary">{d.value} kWh</span> this week — consider scheduling it during off-peak hours.
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
