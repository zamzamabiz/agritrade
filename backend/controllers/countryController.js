import sql from "../config/database.js";

class CountryController {
  // GET /api/countries?search=xyz
  static async findAll(req, res) {
    try {
      const { search } = req.query;
      let query = "SELECT id, name FROM country_dim";
      let params = [];
      if (search) {
        query += " WHERE name ILIKE $1";
        params.push(`%${search}%`);
      }
      query += " ORDER BY name ASC";
      const countries = await sql.unsafe(query, params);
      res.json({ success: true, data: countries });
    } catch (error) {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch countries",
          error: error.message,
        });
    }
  }
}

export default CountryController;
