# SpendiGo Backend (Express.js)

RESTful API untuk aplikasi SpendiGo - Personal Finance untuk Gen Z Indonesia.

## Tech Stack

- **Express.js** - Web framework
- **Prisma** - ORM
- **PostgreSQL** - Database
- **JWT** - Authentication
- **OpenAI** - Chat AI (Spen)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Edit .env dengan konfigurasi database dan API keys
```

### 3. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema ke database
npm run db:push

# Atau gunakan migrations
npm run db:migrate
```

### 4. Run Server

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Auth
- `POST /auth/register` - Register user baru
- `POST /auth/login` - Login
- `GET /auth/me` - Get current user

### Transactions
- `GET /transactions` - List transaksi (pagination, filter)
- `POST /transactions` - Buat transaksi baru
- `PUT /transactions/:id` - Update transaksi
- `DELETE /transactions/:id` - Hapus transaksi
- `POST /transactions/import` - Import CSV

### Analytics
- `GET /analytics/summary` - Ringkasan bulanan
- `GET /analytics/category` - Breakdown per kategori
- `GET /analytics/trend` - Trend harian
- `GET /analytics/spending-dna` - Analisis spending DNA
- `GET /analytics/weekly-wrapped` - Ringkasan mingguan

### Budget
- `GET /budget` - List budget goals
- `POST /budget` - Buat budget goal
- `PUT /budget/:id` - Update budget goal
- `DELETE /budget/:id` - Hapus budget goal

### Predict
- `GET /predict/next-month` - Prediksi bulan depan
- `GET /predict/next-three-months` - Prediksi 3 bulan
- `GET /predict/broke-date` - Prediksi tanggal bokek
- `GET /predict/insights` - Spending insights
- `GET /predict/health-score` - Skor kesehatan finansial
- `GET /predict/status` - Status ML model
- `POST /predict/what-if` - Simulasi what-if

### Chat
- `POST /chat` - Chat dengan Spen AI

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `SECRET_KEY` | JWT secret key | - |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiry | 10080 (7 days) |
| `OPENAI_API_KEY` | OpenAI API key for Spen | - |
| `PORT` | Server port | 8000 |

## License

MIT
