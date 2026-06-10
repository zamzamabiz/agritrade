import crypto from 'crypto';

const normalizeCountry = (name) => {
  if (!name) return null;
  return name.toString().trim().toLowerCase();
};

export const computeChecksum = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

export const toTradeType = (value) => {
  if (!value) return null;
  const v = value.toString().toUpperCase();
  if (v === 'IMPORT' || v === 'I') return 'I';
  if (v === 'EXPORT' || v === 'E') return 'E';
  return null;
};

export const parseChapter = (value) => {
  if (value === undefined || value === null) return null;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 1 || n > 99) return null;
  return n;
};

export const parsePeriodMonth = (value) => {
  if (!value) return null;
  const m = value.toString().trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  const d = new Date(`${m}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

export const ensurePartition = async (sql, periodDate) => {
  const dateOnly = periodDate instanceof Date ? periodDate.toISOString().slice(0, 10) : periodDate;
  await sql`SELECT ensure_trade_fact_partition(${dateOnly});`;
};

export const getOrCreateCountryId = async (sql, countryName) => {
  const normalized = normalizeCountry(countryName);
  if (!normalized) {
    throw new Error('origin_country is required');
  }
  const existing = await sql`SELECT id FROM country_dim WHERE name = ${normalized} LIMIT 1`;
  if (existing.length) return existing[0].id;
  try {
    const inserted = await sql`INSERT INTO country_dim (name) VALUES (${normalized}) RETURNING id`;
    return inserted[0].id;
  } catch (err) {
    const retry = await sql`SELECT id FROM country_dim WHERE name = ${normalized} LIMIT 1`;
    if (retry.length) return retry[0].id;
    throw err;
  }
};
