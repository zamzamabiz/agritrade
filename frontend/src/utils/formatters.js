export const formatComma = (n) => {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString();
};

export const formatKG = (n) => `${formatComma(n)} KG`;

export const formatKGShort = (n) => {
  if (!n) return '0 KG';
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B KG`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M KG`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K KG`;
  return `${n} KG`;
};

export const formatPct = (v) => `${v}%`;

export const formatUSD = (v) => `$${Number(v).toFixed(2)}/KG`;

export default { formatComma, formatKG, formatKGShort, formatPct, formatUSD };
