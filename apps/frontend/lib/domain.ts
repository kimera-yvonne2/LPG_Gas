export type ApiList<T> = T[] | { count: number; next: string | null; previous: string | null; results: T[] };
export const rows = <T,>(data?: ApiList<T>): T[] => !data ? [] : Array.isArray(data) ? data : data.results;

export type Household = { id: number; owner: number; owner_email: string; name: string; email: string; phone: string; address: string; number_of_people: number; usage_type: string };
export type Cylinder = { id: number; household: number; household_name: string; serial_number: string; capacity: string; empty_weight: string; current_weight: string; gas_percentage: string; installation_date: string; status: string; created_at: string; updated_at: string };
export type Sensor = { id: number; cylinder: number; cylinder_serial_number: string; esp32_id: string; firmware_version: string; mac_address: string; battery_level: string; online_status: boolean; last_seen: string | null };
export type Reading = { id: number; sensor: number; esp32_id: string; cylinder_serial_number: string; timestamp: string; weight: string; gas_percentage: string; temperature: string; signal_strength: number };
