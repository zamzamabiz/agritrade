// This file manages the canonical name mapping for importers/exporters
// Schema: { type: 'importer'|'exporter', primary: string, secondary: [string], normalized: string }
// For now, use a DB table in production. Here, we provide DB logic for merging.

/**
 * Merge secondary names into the primary name for a given type (importer/exporter).
 * Updates all trade_fact rows where the name matches any secondary, setting to primary.
 * Optionally, insert into a mapping table for future normalization.
 */
async function mergeNames({ sql, type, primary, secondary }) {
  if (!primary || !Array.isArray(secondary) || !type) throw new Error('Missing required fields');
  const col = type === 'exporter' ? 'exporter_name' : 'importer_name';
  // Update trade_fact table
  if (secondary.length === 0) return { updated: 0 };
  const res = await sql.unsafe(
    `UPDATE trade_fact SET ${col} = $1 WHERE ${col} = ANY($2::text[])`,
    [primary, secondary]
  );
  // Optionally, insert mapping into a mapping table for future normalization (not implemented here)
  return { updated: res.count || 0 };
}

export { mergeNames };
