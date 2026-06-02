# SpendiGo

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
- Express.js (Node.js)
- PostgreSQL
- Prisma ORM
- JWT Authentication
- OpenAI API (Chat AI)

### Machine Learning
- TensorFlow/Keras (LSTM Model)
- Functional API Architecture
- Custom Training Callbacks
- TensorBoard Integration

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- npm or pnpm

### 1. Start Database

```bash
docker-compose up -d
```

### 2. Setup Backend

```bash
cd backend-express

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env dengan konfigurasi database dan API keys

# Generate Prisma client
npm run db:generate

# Push schema ke database
npm run db:push

# Run the server
npm run dev
```

Backend akan berjalan di `http://localhost:8000`

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
├── backend-express/            # Express.js project
│   ├── src/
│   │   ├── app.js              # App entry
│   │   ├── routes/             # API endpoints
│   │   ├── middleware/         # Auth, error handling
│   │   ├── config/             # Config & database
│   │   └── utils/              # Utilities
│   ├── prisma/                 # Prisma schema
│   └── ml/                     # ML model files
│
├── DS/                         # Data Science (gitignored)
│   ├── train_lstm.ipynb        # Training notebook
│   ├── lstm_model_best.keras   # Trained model
│   ├── scaler.pkl              # Feature scaler
│   └── logs/tensorboard/       # Training logs
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
SECRET_KEY=your-secret-key-min-32-characters
ACCESS_TOKEN_EXPIRE_MINUTES=10080
OPENAI_API_KEY=sk-your-openai-api-key
PORT=8000
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
2. Pilih repo ini dan set **Root Directory** ke `backend-express`
3. Add environment variables:
   ```
   DATABASE_URL=<copy dari PostgreSQL>
   SECRET_KEY=<generate random string 32+ chars>
   OPENAI_API_KEY=<your OpenAI API key>
   ```
4. Railway akan auto-detect Node.js dan deploy

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
| OPENAI_API_KEY | OpenAI API key untuk Chat Spen |

**Frontend:**
| Variable | Description |
|----------|-------------|
| PUBLIC_API_URL | Backend API URL |

---

## ML Model

### Pre-trained Model
Model LSTM tersedia di `backend-express/ml/`:
- `lstm_model_best.keras` - Trained LSTM model (Functional API)
- `scaler.pkl` - Feature scaler (MinMaxScaler)
- `scaler_target.pkl` - Target scaler

### Model Architecture
- Input: 7 features x 2 timesteps (LOOKBACK)
- LSTM Layer 1: 32 units, return_sequences=True
- Dropout: 0.3
- LSTM Layer 2: 16 units
- Dropout: 0.3
- Dense: 8 units, ReLU
- Output: 1 unit (predicted expense)

### Model Input Features
1. `total_expense` - Total pengeluaran bulan
2. `total_income` - Total pemasukan bulan
3. `net` - Selisih income - expense
4. `frekuensi_exp` - Jumlah transaksi expense
5. `avg_expense` - Rata-rata per transaksi
6. `max_expense` - Expense terbesar
7. `frekuensi_inc` - Jumlah transaksi income

### Training Notebook
Training notebook dengan TensorBoard logging tersedia di `DS/train_lstm.ipynb`:
- Functional API architecture
- Custom Training Callback
- TensorBoard integration
- tf.GradientTape demonstration

---

## Troubleshooting

### Database Connection Error
```bash
# Cek PostgreSQL running
docker ps

# Restart database
docker-compose down && docker-compose up -d
```

### CORS Error di Frontend
Pastikan backend CORS sudah configured untuk frontend URL.

### Prediction Not Working
1. Cek minimal punya 2 bulan data transaksi
2. Cek endpoint `/predict/status` untuk ML model status
3. Lihat logs backend untuk error detail

---

## Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

Built with Astro, Express.js, Prisma, and PostgreSQL
