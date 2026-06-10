import stringSimilarity from "string-similarity";

function normalizeName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "") // remove punctuation
    .replace(/\s+/g, " ") // collapse spaces
    .replace(
      /\b(ltd|limited|pvt|inc|co|company|enterprises|enterprise|trading|foods|impex|overseas|brothers|sons|industries|traders|group|llc|llp|plc|pte|private|corporation|corp|llc|llp|plc|pte)\b/g,
      "",
    ) // remove common suffixes
    .replace(/\s+/g, " ") // collapse spaces again
    .trim();
}

// Fuzzy match API for admin merging
async function getNameClusters(req, res) {
  try {
    const sql = req.sql;
    const { type = "importer", threshold = 0.95 } = req.query;
    // Get all unique names
    let col = type === "exporter" ? "exporter_name" : "importer_name";
    const rows = await sql.unsafe(
      `SELECT DISTINCT ${col} FROM trade_fact WHERE ${col} IS NOT NULL`,
    );
    const names = rows.map((r) => r[col]).filter(Boolean);
    // Normalize
    const normNames = names.map(normalizeName);
    // Build clusters
    let clusters = [];
    let used = new Set();
    for (let i = 0; i < normNames.length; i++) {
      if (used.has(i)) continue;
      let group = [names[i]];
      used.add(i);
      for (let j = i + 1; j < normNames.length; j++) {
        if (used.has(j)) continue;
        const sim = stringSimilarity.compareTwoStrings(
          normNames[i],
          normNames[j],
        );
        if (sim >= threshold) {
          group.push(names[j]);
          used.add(j);
        }
      }
      if (group.length > 1)
        clusters.push({
          primary: group[0],
          secondary: group.slice(1),
          normalized: normalizeName(group[0]),
        });
    }
    res.json({ success: true, clusters });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to cluster names",
        error: error.message,
      });
  }
}

export { normalizeName, getNameClusters };
