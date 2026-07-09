import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Device, Reading } from "@/lib/energy";

export const Route = createFileRoute("/_authenticated/alerts")({ component: AlertsPage });

type Alert = {
  id: string; user_id: string; device_id: string | null; type: string; severity: string;
  message: string; acknowledged: boolean; created_at: string;
};

function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [emailNotify, setEmailNotify] = useState(true);

  async function load() {
    const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
    setAlerts((data as Alert[]) ?? []);
  }

  // Simple client-side scan: any device where cumulative energy this week exceeds its threshold → alert
  async function scan() {
    if (!user) return;
    const [{ data: devices }, { data: readings }] = await Promise.all([
      supabase.from("devices").select("*"),
      supabase.from("energy_readings").select("*")
        .gte("recorded_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
        .order("recorded_at", { ascending: true }),
    ]);
    const toInsert: Omit<Alert, "id" | "created_at" | "acknowledged">[] = [];
    for (const d of (devices as Device[]) ?? []) {
      if (!d.threshold_kwh) continue;
      const rs = ((readings as Reading[]) ?? []).filter((r) => r.device_id === d.id);
      if (rs.length < 2) continue;
      const kwh = Math.max(0, rs.at(-1)!.energy_kwh - rs[0]!.energy_kwh);
      if (kwh > d.threshold_kwh) {
        toInsert.push({
          user_id: user.id, device_id: d.id, type: "threshold",
          severity: kwh > d.threshold_kwh * 1.5 ? "critical" : "warning",
          message: `${d.name} used ${kwh.toFixed(1)} kWh this week (threshold: ${d.threshold_kwh} kWh).`,
        });
      }
    }
    if (toInsert.length) {
      await supabase.from("alerts").insert(toInsert);
      toast.success(`${toInsert.length} new alert(s) generated`);
    } else {
      toast.info("No thresholds exceeded.");
    }
    load();
  }

  async function ack(a: Alert) {
    await supabase.from("alerts").update({ acknowledged: true }).eq("id", a.id);
    load();
  }

  useEffect(() => { load(); }, [user?.id]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Alerts & recommendations</h1>
          <p className="text-sm text-muted-foreground">Threshold breaches and system tips.</p>
        </div>
        <Button onClick={scan}><Bell className="mr-2 h-4 w-4" /> Run scan</Button>
      </header>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Email notifications</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Receive an email at <span className="font-medium text-foreground">{user?.email}</span> when a device crosses its threshold.
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="notify" className="text-sm">Enabled</Label>
            <Switch id="notify" checked={emailNotify} onCheckedChange={setEmailNotify} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active alerts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 && <div className="py-8 text-center text-muted-foreground">No alerts. Everything looks efficient.</div>}
          {alerts.map((a) => {
            const isCritical = a.severity === "critical";
            return (
              <div key={a.id} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/40 p-4">
                <div className="flex gap-3">
                  <div className={isCritical ? "text-destructive" : "text-warning"}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isCritical ? "destructive" : "secondary"}>{a.severity}</Badge>
                      {a.acknowledged && <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" /> Ack'd</Badge>}
                    </div>
                    <div className="mt-1 text-sm">{a.message}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </div>
                {!a.acknowledged && <Button size="sm" variant="outline" onClick={() => ack(a)}>Acknowledge</Button>}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
