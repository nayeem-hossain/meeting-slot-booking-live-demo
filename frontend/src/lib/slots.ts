export const SLOT_MINUTES = 15;

export function generateDaySlots(date = new Date()): string[] {
  const values: string[] = [];
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));

  for (let i = 0; i < 96; i += 1) {
    const value = new Date(day.getTime() + i * SLOT_MINUTES * 60 * 1000);
    values.push(value.toISOString());
  }

  return values;
}

export function formatSlot(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
