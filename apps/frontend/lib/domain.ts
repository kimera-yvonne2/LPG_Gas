export type ApiList<T> = T[] | { count: number; next: string | null; previous: string | null; results: T[] };
export const rows = <T,>(data?: ApiList<T>): T[] => !data ? [] : Array.isArray(data) ? data : data.results;

export type Household = { id: number; owner: number; owner_name: string; owner_email?: string; created_at: string; updated_at: string };
export type Cylinder = { id: number; household: number; household_name: string; serial_number: string; capacity: string; empty_weight: string; current_weight: string; gas_percentage: string; installation_date: string; status: string; created_at: string; updated_at: string };
export type Sensor = { id: number; household: number; cylinder: number | null; cylinder_serial_number: string | null; esp32_id: string; firmware_version: string; mac_address: string; battery_level: string; online_status: boolean; is_active: boolean; last_seen: string | null };
export type Reading = { id: number; sensor: number; cylinder: number; esp32_id: string; cylinder_serial_number: string; timestamp: string; weight: string; gas_percentage: string; temperature: string; signal_strength: number; gas_leak_detected: boolean };
export type RefillProvider = { id: number; name: string; email: string; phone_number: string };
export type RefillStatus = "pending" | "accepted" | "in_transit" | "completed" | "cancelled";
export type RefillRequest = { id: number; household: number; assigned_technician: number | null; provider: RefillProvider | null; customer: { name: string; email: string; phone: string } | null; status: RefillStatus; source: "manual" | "automatic"; requested_at: string; updated_at: string };
