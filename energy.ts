import { supabase } from "@/integrations/supabase/client";

export type Device = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  location: string | null;
  rated_power_w: number;
  threshold_kwh: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Reading = {
  id: number;
  device_id: string;
  user_id: string;
  power_w: number;
  energy_kwh: number;
  voltage_v: number | null;
  current_a: number | null;
  recorded_at: string;
};

// Seed demo devices + readings for a new user
export async function ensureSeed(userId: string) {
  const { count } = await supabase.from("devices").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) > 0) return;

  const seedDevices = [
    { name: "Refrigerator", type: "appliance", location: "Kitchen", rated_power_w: 150, threshold_kwh: 60 },
    { name: "Air Conditioner", type: "hvac", location: "Living Room", rated_power_w: 1500, threshold_kwh: 200 },
    { name: "Washing Machine", type: "appliance", location: "Laundry", rated_power_w: 500, threshold_kwh: 30 },
    { name: "TV + Console", type: "entertainment", location: "Living Room", rated_power_w: 200, threshold_kwh: 25 },
    { name: "Water Heater", type: "hvac", location: "Bathroom", rated_power_w: 3000, threshold_kwh: 150 },
  ];
  const { data: devices, error } = await supabase
    .from("devices")
    .insert(seedDevices.map((d) => ({ ...d, user_id: userId })))
    .select();
  if (error || !devices) return;

  // Generate 7 days of hourly readings
  const rows: Omit<Reading, "id">[] = [];
  const now = Date.now();
  for (const d of devices) {
    let cumulative = 0;
    for (let h = 24 * 7; h >= 0; h--) {
      const ts = new Date(now - h * 3600 * 1000);
      const hour = ts.getHours();
      // Diurnal usage pattern with device type modifiers
      const base = d.rated_power_w * 0.15;
      const peak = d.rated_power_w * 0.85;
      const factor =
        d.type === "hvac" ? (hour >= 18 || hour <= 6 ? 0.9 : 0.4) :
        d.type === "entertainment" ? (hour >= 18 && hour <= 23 ? 0.9 : 0.15) :
        d.type === "appliance" ? (hour >= 7 && hour <= 22 ? 0.55 : 0.2) : 0.4;
      const noise = 0.85 + Math.random() * 0.3;
      const power = base + (peak - base) * factor * noise;
      const kwh = power / 1000; // 1 hour
      cumulative += kwh;
      rows.push({
        device_id: d.id, user_id: userId,
        power_w: Math.round(power * 10) / 10,
        energy_kwh: Math.round(cumulative * 100) / 100,
        voltage_v: 220 + Math.round(Math.random() * 10 - 5),
        current_a: Math.round((power / 220) * 100) / 100,
        recorded_at: ts.toISOString(),
      });
    }
  }
  // Insert in chunks
  for (let i = 0; i < rows.length; i += 200) {
    await supabase.from("energy_readings").insert(rows.slice(i, i + 200));
  }
}

// Add a fresh "live" reading — used to animate the dashboard
export async function pushLiveReading(userId: string, device: Device, lastKwh: number) {
  const hour = new Date().getHours();
  const base = device.rated_power_w * 0.15;
  const peak = device.rated_power_w * 0.85;
  const factor =
    device.type === "hvac" ? (hour >= 18 || hour <= 6 ? 0.9 : 0.4) :
    device.type === "entertainment" ? (hour >= 18 && hour <= 23 ? 0.9 : 0.15) :
    device.type === "appliance" ? (hour >= 7 && hour <= 22 ? 0.55 : 0.2) : 0.4;
  const power = base + (peak - base) * factor * (0.85 + Math.random() * 0.3);
  const kwh = lastKwh + power / 1000 / 60; // 1 minute of energy
  await supabase.from("energy_readings").insert({
    device_id: device.id, user_id: userId,
    power_w: Math.round(power * 10) / 10,
    energy_kwh: Math.round(kwh * 1000) / 1000,
    voltage_v: 220 + Math.round(Math.random() * 10 - 5),
    current_a: Math.round((power / 220) * 100) / 100,
  });
}
