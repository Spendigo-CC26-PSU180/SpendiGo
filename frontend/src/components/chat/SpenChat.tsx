import { useState, useRef, useEffect } from 'react';
import { Send, Plus, BarChart3, Check, Loader2, TrendingUp } from 'lucide-react';
import { chatApi, transactionsApi, type ChatMessage, type ActionCard } from '../../lib/api';

const quickPrompts = [
  'Gimana kondisi keuanganku bulan ini?',
  'Tips hemat untuk kategori makan',
  'Analisis pengeluaran terbesarku',
  'Cara menabung yang efektif',
];

interface Message extends ChatMessage {
  actions?: ActionCard[];
}

export default function SpenChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await chatApi.send(text, history);
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.reply,
        actions: response.data.suggested_actions,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Maaf, aku lagi ada kendala teknis. Coba lagi nanti ya!',
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const [savingTransaction, setSavingTransaction] = useState<string | null>(null);
  const [savedTransactions, setSavedTransactions] = useState<Set<string>>(new Set());

  const handleAction = async (action: ActionCard, actionKey: string) => {
    if (action.type === 'add_transaction') {
      window.location.href = '/transactions?action=add';
    } else if (action.type === 'view_report') {
      window.location.href = '/dashboard';
    } else if (action.type === 'view_predictions') {
      window.location.href = '/insights';
    } else if (action.type === 'save_transaction' && action.data) {
      setSavingTransaction(actionKey);
      try {
        const today = new Date().toISOString().split('T')[0];
        await transactionsApi.create({
          date: today,
          amount: action.data.amount!,
          type: action.data.type!,
          category: action.data.category!,
          description: action.data.description || ''
        });
        setSavedTransactions(prev => new Set(prev).add(actionKey));
      } catch (error) {
        console.error('Failed to save transaction:', error);
        alert('Gagal menyimpan transaksi');
      } finally {
        setSavingTransaction(null);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <img src="/spen.png" alt="Spen" className="w-12 h-12" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Chat dengan Spen</h1>
            <p className="text-sm text-gray-500">AI assistant keuanganmu</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <img src="/spen.png" alt="Spen" className="w-24 h-24 mb-4 opacity-50" />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              Halo! Aku Spen
            </h2>
            <p className="text-sm text-gray-500 mb-6 max-w-md">
              AI assistant yang siap bantu kamu menganalisis keuangan dan memberikan
              tips personal sesuai kondisi keuanganmu.
            </p>

            {/* Quick Prompts */}
            <div className="w-full max-w-md space-y-2">
              <p className="text-xs text-gray-400 mb-2">Coba tanya:</p>
              <div className="grid grid-cols-1 gap-2">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickPrompt(prompt)}
                    className="p-3 text-left text-sm bg-white border border-gray-200 rounded-xl hover:bg-primary-50 hover:border-primary-200 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, idx) => (
              <div key={idx}>
                <div
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <img
                      src="/spen.png"
                      alt="Spen"
                      className="w-8 h-8 mr-2 flex-shrink-0"
                    />
                  )}
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-primary-500 text-white rounded-br-md'
                        : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>

                {/* Action Cards */}
                {message.actions && message.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-10">
                    {message.actions.map((action, actionIdx) => {
                      const actionKey = `${idx}-${actionIdx}`;
                      const isSaving = savingTransaction === actionKey;
                      const isSaved = savedTransactions.has(actionKey);

                      return (
                        <button
                          key={actionIdx}
                          onClick={() => handleAction(action, actionKey)}
                          disabled={isSaving || isSaved}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            isSaved
                              ? 'bg-green-50 border border-green-200 text-green-700'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                          } ${isSaving ? 'opacity-50' : ''}`}
                        >
                          {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                          ) : isSaved ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : action.type === 'save_transaction' ? (
                            <Plus className="w-4 h-4 text-primary-500" />
                          ) : action.type === 'view_report' ? (
                            <BarChart3 className="w-4 h-4 text-primary-500" />
                          ) : action.type === 'view_predictions' ? (
                            <TrendingUp className="w-4 h-4 text-primary-500" />
                          ) : (
                            <Plus className="w-4 h-4 text-primary-500" />
                          )}
                          {isSaved ? 'Tersimpan!' : action.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator - 3 dots animation */}
            {loading && (
              <div className="flex justify-start">
                <img src="/spen.png" alt="Spen" className="w-8 h-8 mr-2" />
                <div className="bg-white border border-gray-100 px-5 py-4 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanya Spen..."
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
