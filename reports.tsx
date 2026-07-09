import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Device, Reading } from "@/lib/energy";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

const RATE = 0.15;

function ReportsPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: d }, { data: r }] = await Promise.all([
        supabase.from("devices").select("*").order("name"),
        supabase.from("energy_readings").select("*")
          .gte("recorded_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
          .order("recorded_at", { ascending: true }),
      ]);
      setDevices((d as Device[]) ?? []);
      setReadings((r as Reading[]) ?? []);
    })();
  }, [user?.id]);

  const rows = useMemo(() => {
    return devices.map((d) => {
      const rs = readings.filter((r) => r.device_id === d.id);
      const kwh = rs.length ? Math.max(0, rs.at(-1)!.energy_kwh - rs[0]!.energy_kwh) : 0;
      const avgPower = rs.length ? rs.reduce((s, r) => s + r.power_w, 0) / rs.length : 0;
      const peak = rs.length ? Math.max(...rs.map((r) => r.power_w)) : 0;
      return { device: d.name, type: d.type, kwh, avgPower, peak, cost: kwh * RATE };
    });
  }, [devices, readings]);

  const totalKwh = rows.reduce((s, r) => s + r.kwh, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);

  function exportCsv() {
    const header = ["Device", "Type", "Energy (kWh)", "Avg Power (W)", "Peak (W)", "Estimated cost ($)"];
    const csv = [header, ...rows.map((r) => [r.device, r.type, r.kwh.toFixed(2), r.avgPower.toFixed(1), r.peak.toFixed(0), r.cost.toFixed(2)])]
      .map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `voltiq-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Last 30 days · per-device breakdown.</p>
        </div>
        <Button onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total energy</div>
          <div className="mt-2 text-2xl font-semibold">{totalKwh.toFixed(1)} kWh</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated cost</div>
          <div className="mt-2 text-2xl font-semibold">${totalCost.toFixed(2)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Devices tracked</div>
          <div className="mt-2 text-2xl font-semibold">{devices.length}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Per-device summary</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Energy</TableHead>
                <TableHead className="text-right">Avg power</TableHead>
                <TableHead className="text-right">Peak</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.device}>
                  <TableCell className="font-medium">{r.device}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{r.type}</TableCell>
                  <TableCell className="text-right">{r.kwh.toFixed(2)} kWh</TableCell>
                  <TableCell className="text-right">{r.avgPower.toFixed(0)} W</TableCell>
                  <TableCell className="text-right">{r.peak.toFixed(0)} W</TableCell>
                  <TableCell className="text-right text-primary">${r.cost.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
