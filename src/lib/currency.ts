const pkrFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Full PKR display for amounts (PKR is used site-wide). */
export function formatPkr(amount: number): string {
  return pkrFormatter.format(amount);
}

/** Shorter labels for chart axes. */
export function formatPkrAxis(value: number): string {
  const n = Math.abs(value);
  if (n >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}
