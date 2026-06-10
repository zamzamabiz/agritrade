# AgriTrade-Insights

## Technologies Used

### Backend
- Node.js
- Express.js
- MySQL (Database)
- Multer (File upload middleware)
- Other utilities: excelParser, custom middleware

### Frontend
- React.js
- CSS Modules

## Database
- PSQL
- Schema file: `backend/project-tables.sql`
- Configuration: `backend/config/database.js`

## How to Run

### Backend
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   (or)
   ```bash
   node server.js
   ```

### Frontend
1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the React app:
   ```bash
   npm start
   ```

## Notes
- Ensure PSQL is running and configured as per `backend/config/database.js`.
- Import the schema from `backend/project-tables.sql` into your MySQL database before starting the backend.
- The backend and frontend run independently. Backend typically runs on port 5000, frontend on port 3000.

---
For any issues, check the respective folder's README or contact the maintainer.
