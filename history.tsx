import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Device, Reading } from "@/lib/energy";

export const Route = createFileRoute("/_authenticated/history")({ component: HistoryPage });

function HistoryPage() {
  const { user } = useAuth();
  const [range, setRange] = useState("7");
  const [devices, setDevices] = useState<Device[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: d }, { data: r }] = await Promise.all([
        supabase.from("devices").select("*").order("name"),
        supabase.from("energy_readings").select("*")
          .gte("recorded_at", new Date(Date.now() - Number(range) * 24 * 3600 * 1000).toISOString())
          .order("recorded_at", { ascending: true }),
      ]);
      setDevices((d as Device[]) ?? []);
      setReadings((r as Reading[]) ?? []);
    })();
  }, [user?.id, range]);

  const daily = useMemo(() => {
    const bucket = new Map<string, number>();
    // per device delta per day
    const byDevice = new Map<string, Reading[]>();
    for (const r of readings) {
      const arr = byDevice.get(r.device_id) ?? [];
      arr.push(r); byDevice.set(r.device_id, arr);
    }
    for (const arr of byDevice.values()) {
      for (let i = 1; i < arr.length; i++) {
        const day = new Date(arr[i].recorded_at).toLocaleDateString();
        const delta = Math.max(0, arr[i].energy_kwh - arr[i - 1].energy_kwh);
        bucket.set(day, (bucket.get(day) ?? 0) + delta);
      }
    }
    return Array.from(bucket.entries()).map(([day, kwh]) => ({ day, kwh: Math.round(kwh * 100) / 100 }));
  }, [readings]);

  const perDeviceLines = useMemo(() => {
    // build hourly average W per device
    const hours = new Map<string, Record<string, number | string>>();
    for (const r of readings) {
      const d = new Date(r.recorded_at);
      const key = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}h`;
      const row = (hours.get(key) as Record<string, number | string>) ?? { label: key };
      const dev = devices.find((x) => x.id === r.device_id);
      if (dev) row[dev.name] = Math.round((Number(row[dev.name] ?? 0) + r.power_w) * 10) / 10;
      hours.set(key, row);
    }
    return Array.from(hours.values());
  }, [readings, devices]);

  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Consumption history</h1>
          <p className="text-sm text-muted-foreground">Trends over your selected range.</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </header>

      <Card>
        <CardHeader><CardTitle>Daily energy (kWh)</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} unit=" kWh" />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="kwh" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Per-device power draw</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={perDeviceLines}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} minTickGap={40} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} unit=" W" />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Legend />
              {devices.map((d, i) => (
                <Line key={d.id} dataKey={d.name} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
