import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Device } from "@/lib/energy";

export const Route = createFileRoute("/_authenticated/devices")({ component: DevicesPage });

const TYPES = ["appliance", "hvac", "entertainment", "lighting", "other"];

function DevicesPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState({ name: "", type: "appliance", location: "", rated_power_w: 100, threshold_kwh: 50, status: "active" });

  async function load() {
    const { data } = await supabase.from("devices").select("*").order("name");
    setDevices((data as Device[]) ?? []);
  }
  useEffect(() => { load(); }, [user?.id]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", type: "appliance", location: "", rated_power_w: 100, threshold_kwh: 50, status: "active" });
    setOpen(true);
  }
  function openEdit(d: Device) {
    setEditing(d);
    setForm({ name: d.name, type: d.type, location: d.location ?? "", rated_power_w: d.rated_power_w, threshold_kwh: d.threshold_kwh ?? 0, status: d.status });
    setOpen(true);
  }
  async function save() {
    if (!user) return;
    if (!form.name.trim()) return toast.error("Name is required");
    if (editing) {
      const { error } = await supabase.from("devices").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Device updated");
    } else {
      const { error } = await supabase.from("devices").insert({ ...form, user_id: user.id });
      if (error) return toast.error(error.message);
      toast.success("Device added");
    }
    setOpen(false);
    load();
  }
  async function remove(d: Device) {
    if (!confirm(`Delete ${d.name}?`)) return;
    const { error } = await supabase.from("devices").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Devices</h1>
          <p className="text-sm text-muted-foreground">Manage the devices you monitor.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add device</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit device" : "New device"}</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2"><Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="grid gap-2"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Rated power (W)</Label>
                  <Input type="number" value={form.rated_power_w} onChange={(e) => setForm({ ...form, rated_power_w: Number(e.target.value) })} /></div>
                <div className="grid gap-2"><Label>Alert threshold (kWh / month)</Label>
                  <Input type="number" value={form.threshold_kwh} onChange={(e) => setForm({ ...form, threshold_kwh: Number(e.target.value) })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Save" : "Add"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Rated</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No devices yet — add your first.</TableCell></TableRow>
              )}
              {devices.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{d.type}</TableCell>
                  <TableCell className="text-muted-foreground">{d.location ?? "—"}</TableCell>
                  <TableCell className="text-right">{d.rated_power_w} W</TableCell>
                  <TableCell className="text-right">{d.threshold_kwh ?? "—"} kWh</TableCell>
                  <TableCell>
                    <Badge variant={d.status === "active" ? "default" : "secondary"}>{d.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
