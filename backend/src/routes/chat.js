const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const prisma = require('../config/database');
const config = require('../config');
const authMiddleware = require('../middleware/auth');

// Valid categories
const EXPENSE_CATEGORIES = ['makan', 'transport', 'belanja online', 'fashion', 'kopi', 'hiburan', 'nongkrong', 'top up game', 'kuota', 'skincare', 'kesehatan', 'edukasi', 'kos/kontrakan', 'tagihan', 'investasi', 'lainnya'];
const INCOME_CATEGORIES = ['gaji', 'freelance', 'bonus', 'hadiah', 'investasi', 'lainnya'];

// Intent categories
const INTENTS = {
  basic: ['halo', 'hai', 'hi', 'hey', 'apa kabar', 'siapa kamu', 'help', 'bantuan'],
  category: ['kategori', 'pengeluaran', 'spending', 'habis', 'boros', 'hemat', 'makan', 'kopi', 'transport', 'belanja', 'tagihan'],
  prediction: ['prediksi', 'forecast', 'bulan depan', 'perkiraan', 'estimasi', 'akan'],
  broke: ['bokek', 'habis', 'cukup', 'sampai kapan', 'tanggal berapa', 'broke'],
  transaction: ['catat', 'simpan', 'beli', 'bayar', 'gaji', 'dapat', 'terima', 'belanja', 'ongkos', 'naik', 'jajan', 'investasi', 'invest', 'saham', 'reksadana', 'crypto'],
  advice: ['tips', 'saran', 'gimana', 'bagaimana', 'cara', 'strategi', 'rekomendasi'],
};

// Non-financial keywords
const NON_FINANCIAL_KEYWORDS = [
  'resep', 'masak', 'cuaca', 'weather', 'politik', 'berita', 'news',
  'film', 'movie', 'musik', 'lagu', 'game', 'main', 'pacaran', 'cinta',
  'coding', 'program', 'code', 'debug', 'error', 'bug',
  'sejarah', 'history', 'geografi', 'fisika', 'kimia', 'biologi',
  'cerita', 'dongeng', 'puisi', 'joke', 'lelucon', 'lucu',
];

const classifyIntent = (message) => {
  const messageLower = message.toLowerCase();
  const detectedIntents = [];

  for (const [intent, keywords] of Object.entries(INTENTS)) {
    if (keywords.some((kw) => messageLower.includes(kw))) {
      detectedIntents.push(intent);
    }
  }

  return detectedIntents.length > 0 ? detectedIntents : ['basic'];
};

const isNonFinancialQuestion = (message) => {
  const messageLower = message.toLowerCase();

  let financialScore = 0;
  let nonFinancialScore = 0;

  const allFinancialKeywords = Object.values(INTENTS).flat();
  allFinancialKeywords.push('uang', 'rupiah', 'duit', 'saldo', 'balance', 'budget', 'anggaran');

  for (const kw of allFinancialKeywords) {
    if (messageLower.includes(kw)) financialScore++;
  }

  for (const kw of NON_FINANCIAL_KEYWORDS) {
    if (messageLower.includes(kw)) nonFinancialScore++;
  }

  return nonFinancialScore > 0 && financialScore === 0;
};

// Context builders
const buildBasicContext = async (userId) => {
  const today = new Date();
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const totals = await prisma.transaction.groupBy({
    by: ['type'],
    where: { userId },
    _sum: { amount: true },
  });

  let allTimeIncome = 0;
  let allTimeExpense = 0;
  for (const t of totals) {
    if (t.type === 'income') allTimeIncome = Number(t._sum.amount || 0);
    else allTimeExpense = Number(t._sum.amount || 0);
  }

  const thisMonthTotals = await prisma.transaction.groupBy({
    by: ['type'],
    where: {
      userId,
      date: { gte: thisMonthStart },
    },
    _sum: { amount: true },
  });

  let thisMonthIncome = 0;
  let thisMonthExpense = 0;
  for (const t of thisMonthTotals) {
    if (t.type === 'income') thisMonthIncome = Number(t._sum.amount || 0);
    else thisMonthExpense = Number(t._sum.amount || 0);
  }

  return `Data Ringkas:
- Total Saldo (semua waktu): Rp ${(allTimeIncome - allTimeExpense).toLocaleString('id-ID')}
- Total Pemasukan: Rp ${allTimeIncome.toLocaleString('id-ID')}
- Total Pengeluaran: Rp ${allTimeExpense.toLocaleString('id-ID')}
- Pemasukan bulan ini: Rp ${thisMonthIncome.toLocaleString('id-ID')}
- Pengeluaran bulan ini: Rp ${thisMonthExpense.toLocaleString('id-ID')}`;
};

const buildCategoryContext = async (userId) => {
  const categories = await prisma.transaction.groupBy({
    by: ['category'],
    where: { userId, type: 'expense' },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 7,
  });

  if (categories.length === 0) return '';

  let context = '\nTotal Pengeluaran per Kategori (Semua Waktu):\n';
  for (const cat of categories) {
    context += `- ${cat.category}: Rp ${Number(cat._sum.amount).toLocaleString('id-ID')}\n`;
  }

  return context;
};

const buildSystemPrompt = async (intents, userId) => {
  const basePrompt = `Kamu adalah Spen, AI financial assistant untuk aplikasi SpendiGo.

GAYA KOMUNIKASI:
- SINGKAT dan TO THE POINT, maksimal 2-3 kalimat per respons
- Casual, pakai "kamu" bukan "Anda"
- Bahasa Indonesia natural, boleh campur bahasa gaul dikit
- Emoji minimal, hanya kalau perlu
- JANGAN bertele-tele atau basa-basi

FORMAT RESPONS:
- Langsung jawab pertanyaan
- Kalau kasih tips, pakai bullet points singkat
- Angka/nominal langsung sebutkan tanpa penjelasan panjang

LARANGAN:
- Jangan minta data sensitif (password, PIN, rekening)
- Jangan beri saran investasi spesifik
- Hanya jawab pertanyaan terkait keuangan pribadi
`;

  const contextParts = [];

  if (intents.includes('basic') || intents.includes('advice')) {
    contextParts.push(await buildBasicContext(userId));
  }

  if (intents.includes('category') || intents.includes('advice')) {
    contextParts.push(await buildCategoryContext(userId));
  }

  if (contextParts.length > 0) {
    return `${basePrompt}\n\n${contextParts.join('\n')}\n\nBerdasarkan data di atas, berikan advice yang personalized.`;
  }

  return basePrompt;
};

const parseTransactionFromMessage = async (client, message) => {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `Extract transaction info from user message. Return JSON only.
Format: {"amount": number, "type": "income"|"expense", "category": string, "description": string}
Categories expense: makan, transport, belanja online, kopi, hiburan, tagihan, kos/kontrakan, kesehatan, pendidikan, lainnya
Categories income: gaji, freelance, bonus, hadiah, investasi, lainnya
If can't parse, return: {"error": true}
Examples:
- "beli kopi 25rb" -> {"amount": 25000, "type": "expense", "category": "kopi", "description": "beli kopi"}
- "gajian 5jt" -> {"amount": 5000000, "type": "income", "category": "gaji", "description": "gajian"}`,
        },
        { role: 'user', content: message },
      ],
    });

    let result = response.choices[0].message.content.trim();
    result = result.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(result);
    return parsed.error ? null : parsed;
  } catch {
    return null;
  }
};

// POST /chat
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;

    if (!config.OPENAI_API_KEY) {
      return res.status(503).json({
        detail: 'Spen AI belum dikonfigurasi. Hubungi admin.',
      });
    }

    // Hard gate for non-financial questions
    if (isNonFinancialQuestion(message)) {
      return res.json({
        reply: 'Hmm, aku Spen, asisten keuangan kamu. Aku cuma bisa bantu soal keuangan ya! Ada yang mau ditanya soal pengeluaran, budget, atau tips nabung? 💰',
        suggested_actions: [],
      });
    }

    const intents = classifyIntent(message);
    const systemPrompt = await buildSystemPrompt(intents, req.user.id);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages,
    });

    const reply = response.choices[0].message.content;
    const suggestedActions = [];
    const messageLower = message.toLowerCase();

    // Check for transaction intent
    if (intents.includes('transaction')) {
      const amountPattern = /\d+[,.]?\d*\s*(rb|ribu|k|jt|juta)?|\d{4,}/i;
      if (amountPattern.test(messageLower)) {
        const parsed = await parseTransactionFromMessage(client, message);
        if (parsed && parsed.amount) {
          suggestedActions.push({
            type: 'save_transaction',
            label: `Simpan: ${parsed.description || 'Transaksi'}`,
            data: {
              amount: parsed.amount,
              type: parsed.type,
              category: parsed.category,
              description: parsed.description || '',
            },
          });
        }
      }
    }

    // Check for report request
    if (['laporan', 'report', 'analisis', 'statistik', 'trend'].some((w) => messageLower.includes(w))) {
      suggestedActions.push({
        type: 'view_report',
        label: 'Lihat Dashboard',
        data: {},
      });
    }

    // Check for prediction request
    if (intents.includes('prediction')) {
      suggestedActions.push({
        type: 'view_predictions',
        label: 'Lihat Prediksi',
        data: {},
      });
    }

    res.json({
      reply,
      suggested_actions: suggestedActions,
    });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ detail: 'API key Spen AI tidak valid. Hubungi admin.' });
    }
    if (error.status === 402 || error.message?.includes('insufficient_quota')) {
      return res.status(402).json({ detail: 'Spen AI membutuhkan top-up credit. Hubungi admin.' });
    }
    next(error);
  }
});

module.exports = router;
