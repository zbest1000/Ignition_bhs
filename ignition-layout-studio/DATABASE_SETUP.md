# Database Configuration

The application uses PostgreSQL as the default database with automatic SQLite fallback.

## Default Behavior

1. **PostgreSQL First**: The system attempts to connect to PostgreSQL using the configured settings
2. **SQLite Fallback**: If PostgreSQL connection fails, it automatically falls back to SQLite
3. **Development Mode**: Uses SQLite by default for easy setup
4. **Production Mode**: Requires PostgreSQL configuration

## Configuration

### PostgreSQL (Default)
```bash
# Environment variables
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ignition_layout_studio_dev
DB_USER=postgres
DB_PASSWORD=your_password
```

### SQLite (Fallback)
```bash
# Automatic fallback configuration
DB_DIALECT=sqlite
DB_STORAGE=./database.sqlite
```

## Setup Instructions

### Option 1: PostgreSQL Setup
1. Install PostgreSQL on your system
2. Create a database: `createdb ignition_layout_studio_dev`
3. Set environment variables or create `.env` file:
   ```
   DB_DIALECT=postgres
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=ignition_layout_studio_dev
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

### Option 2: SQLite Only (Quick Start)
1. Set environment variable:
   ```
   DB_DIALECT=sqlite
   ```
2. The SQLite database file will be created automatically

### Option 3: Automatic Fallback (Recommended)
1. No configuration needed
2. System will try PostgreSQL first, then fallback to SQLite
3. Check logs to see which database is being used

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_DIALECT` | `postgres` | Database type: `postgres` or `sqlite` |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `ignition_layout_studio_dev` | Database name |
| `DB_USER` | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | - | PostgreSQL password |
| `DB_STORAGE` | `./database.sqlite` | SQLite file path |

## Testing Database Connection

Run the server and check the logs:
```bash
cd backend
npm start
```

Look for these log messages:
- `Database connection established successfully (postgres)` - PostgreSQL connected
- `SQLite fallback connection established successfully` - Using SQLite fallback
- `SQLite fallback also failed` - Both databases failed

## Production Considerations

- PostgreSQL is required for production
- Set `NODE_ENV=production` to disable SQLite fallback
- Configure SSL for production PostgreSQL connections
- Use connection pooling for better performance 