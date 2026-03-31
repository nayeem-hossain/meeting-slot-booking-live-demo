export const SLOT_MINUTES = 15;

export function isAlignedTo15MinuteBoundary(date: Date): boolean {
  return date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0 && date.getUTCMinutes() % SLOT_MINUTES === 0;
}

export function validateSlotRange(start: Date, end: Date): void {
  if (end <= start) {
    throw new Error("EndTime must be after StartTime");
  }

  if (!isAlignedTo15MinuteBoundary(start) || !isAlignedTo15MinuteBoundary(end)) {
    throw new Error("StartTime and EndTime must be aligned to 15-minute boundaries");
  }

  const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
  if (minutes % SLOT_MINUTES !== 0) {
    throw new Error("Requested slot range must be a multiple of 15 minutes");
  }
}

export function getQuarterHourBlocks(start: Date, end: Date): number {
  validateSlotRange(start, end);
  return (end.getTime() - start.getTime()) / (1000 * 60 * SLOT_MINUTES);
}

export function calculatePrice(hourlyRate: number, blocks: number): number {
  return Number(((hourlyRate * blocks) / 4).toFixed(2));
}
