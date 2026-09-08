export function storefrontPriceLabel(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return "Call for price";
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

