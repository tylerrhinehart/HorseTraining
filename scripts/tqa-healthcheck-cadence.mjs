// Anchor-relative UTC days preserve a five-day interval across month/year boundaries.
export function isDue(date, interval, anchor='2026-10-03') {
  if (![1,5].includes(Number(interval))) throw new Error('Choose 1 or 5 days before enabling the schedule.');
  const now = new Date(date); const start = new Date(`${anchor}T00:00:00Z`);
  if (Number.isNaN(now.getTime()) || Number.isNaN(start.getTime())) throw new Error('Invalid cadence date.');
  const days = Math.floor(now.getTime()/86_400_000) - Math.floor(start.getTime()/86_400_000);
  return days >= 0 && days % Number(interval) === 0;
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  console.log(`due=${isDue(new Date(),process.env.TQA_INTERVAL_DAYS,process.env.TQA_INTERVAL_ANCHOR || '2026-10-03')}`);
}
