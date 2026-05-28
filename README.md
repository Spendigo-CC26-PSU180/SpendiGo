# Spendigo

Personal Finance Web App untuk Gen Z Indonesia.

**Tagline:** Kelola keuanganmu, pahami polamu

## Tech Stack

### Frontend
- Astro (Static-first framework)
- React (via Astro Islands)
- Tailwind CSS
- Recharts
- Lucide React Icons
- Axios

### Backend
- FastAPI (Python)
- PostgreSQL
- SQLAlchemy + Alembic
- JWT Authentication
- Pydantic
- TensorFlow/Keras (LSTM Model)
- OpenAI API (Chat AI)

## Quick Start

### Prerequisites
- Docker & Docker Compose
- **Python 3.10 - 3.12** (Python 3.13+ belum fully supported)
- Node.js 18+
- npm or pnpm

### 1. Start Database

```bash
docker-compose up -d
```

### 2. Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend akan berjalan di `http://localhost:8000`
Dokumentasi API: `http://localhost:8000/docs`

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Frontend akan berjalan di `http://localhost:4321`

## Project Structure

```
spendigo/
├── frontend/                    # Astro project
│   ├── src/
│   │   ├── pages/              # Astro pages
│   │   ├── components/         # React & Astro components
│   │   ├── lib/                # Utilities & API client
│   │   └── styles/             # Global CSS
│   └── public/                 # Static assets
│
├── backend/                    # FastAPI project
│   ├── main.py                 # App entry
│   ├── database.py             # SQLAlchemy setup
│   ├── models/                 # Database models
│   ├── schemas/                # Pydantic schemas
│   ├── routers/                # API endpoints
│   └── core/                   # Config, security, deps
│
└── docker-compose.yml          # PostgreSQL
```

## Features

### Dashboard
- **Ringkasan Keuangan** - Total pemasukan, pengeluaran, dan saldo
- **Chart Tren Harian** - Visualisasi pengeluaran 30 hari terakhir
- **Kategori Breakdown** - Pie chart pengeluaran per kategori
- **Transaksi Terakhir** - Quick view 5 transaksi terbaru
- **Weekly Wrapped** - Ringkasan mingguan dengan insight

### Transaksi
- **CRUD Transaksi** - Tambah, edit, hapus transaksi
- **Filter & Pagination** - Filter by tipe, kategori, bulan
- **CSV Import** - Upload bulk transaksi via CSV
- **CSV Template** - Template siap pakai untuk import

### AI Features (LSTM Model)
- **Prediksi Bulan Depan** - Prediksi pengeluaran bulan depan dengan confidence score
- **Prediksi 3 Bulan** - Rolling prediction untuk 3 bulan ke depan
- **What-If Simulator** - Simulasi perubahan income/expense dan dampaknya
- **Spending DNA** - Analisis pola pengeluaran (Hedonist, Penabung, Seimbang, Unpredictable)
- **Broke Date** - Prediksi tanggal uang habis berdasarkan spending rate
- **Health Score** - Skor kesehatan finansial dengan breakdown checks

### Chat AI (Spen)
- **Financial Assistant** - Chat dengan AI untuk pertanyaan keuangan
- **Context-Aware** - Memahami data transaksi user
- **Transaction Recording** - Catat transaksi via chat natural language
- **Spending Advice** - Tips dan saran pengelolaan keuangan

### Insights Page
- **Month Picker** - Navigasi data per bulan
- **Category Comparison** - Perbandingan pengeluaran vs bulan lalu
- **Budget Goals** - Set dan track target budget per kategori
- **Insight Cards** - Warning dan success notifications

### Other Features
- **JWT Authentication** - Secure login/register
- **Responsive Design** - Mobile-first, works on all devices
- **Dark/Light Mode Ready** - CSS variables for theming

## API Endpoints

### Auth
- `POST /auth/register` - Register user
- `POST /auth/login` - Login
- `GET /auth/me` - Get current user

### Transactions
- `GET /transactions` - List transactions (with filters & pagination)
- `POST /transactions` - Create transaction
- `POST /transactions/import` - Import transactions from CSV
- `PUT /transactions/:id` - Update transaction
- `DELETE /transactions/:id` - Delete transaction

### Analytics
- `GET /analytics/summary` - Monthly summary (income, expense, balance)
- `GET /analytics/category` - Category breakdown with percentages
- `GET /analytics/trend` - Daily trend data (30/60/90 days)
- `GET /analytics/spending-dna` - Spending personality analysis
- `GET /analytics/weekly-wrapped` - Weekly spending summary

### Predict (AI/ML)
- `GET /predict/next-month` - LSTM expense prediction for next month
- `GET /predict/next-three-months` - Rolling 3-month prediction
- `GET /predict/broke-date` - Predict when money runs out
- `GET /predict/insights` - Spending insights & warnings
- `GET /predict/health-score` - Financial health score (0-100)
- `GET /predict/status` - ML model status check
- `POST /predict/what-if` - What-if simulation

### Chat
- `POST /chat` - Chat with Spen AI assistant

### Budget
- `GET /budget` - Get budget goals for month
- `POST /budget` - Create/update budget goal
- `DELETE /budget/:id` - Delete budget goal

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://spendigo:password@localhost:5432/spendigo_db
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

### Frontend (.env)
```
PUBLIC_API_URL=http://localhost:8000
```

## Categories

### Expense
makan, transport, belanja online, fashion, kopi, hiburan, nongkrong, top up game, kuota, skincare, kesehatan, edukasi, kos/kontrakan, tagihan, investasi, lainnya

### Income
gaji, freelance, bonus, hadiah, investasi, lainnya

---

## Railway Deployment

### Step 1: Create Railway Project
1. Go to [railway.app](https://railway.app) dan login
2. Create new project

### Step 2: Deploy PostgreSQL
1. Add PostgreSQL dari Railway dashboard
2. Copy DATABASE_URL dari PostgreSQL service

### Step 3: Deploy Backend
1. Dari Railway dashboard, klik "New Service" → "GitHub Repo"
2. Pilih repo ini dan set **Root Directory** ke `backend`
3. Add environment variables:
   ```
   DATABASE_URL=<copy dari PostgreSQL>
   SECRET_KEY=<generate random string 32+ chars>
   FRONTEND_URL=<URL frontend setelah deploy, e.g. https://spendigo-frontend.up.railway.app>
   ```
4. Railway akan auto-detect Python dan deploy

### Step 4: Deploy Frontend
1. Klik "New Service" → "GitHub Repo"
2. Pilih repo yang sama, set **Root Directory** ke `frontend`
3. Add environment variables:
   ```
   PUBLIC_API_URL=<URL backend, e.g. https://spendigo-backend.up.railway.app>
   ```
4. Railway akan auto-build dan deploy

### Environment Variables Summary

**Backend:**
| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string (dari Railway PostgreSQL) |
| SECRET_KEY | JWT secret key (min 32 chars) |
| FRONTEND_URL | Frontend URL untuk CORS |

**Frontend:**
| Variable | Description |
|----------|-------------|
| PUBLIC_API_URL | Backend API URL |

### Tips
- Pastikan backend sudah live sebelum deploy frontend
- Update FRONTEND_URL di backend setelah frontend URL tersedia
- Gunakan Railway's auto-generated domain atau custom domain

---

Built with Astro, FastAPI, and PostgreSQL
