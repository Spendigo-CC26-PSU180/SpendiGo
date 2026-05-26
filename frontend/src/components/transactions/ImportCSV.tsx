import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react';
import { transactionsApi, type ImportResult } from '../../lib/api';
import Modal from '../ui/Modal';

interface ImportCSVProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportCSV({ isOpen, onClose, onSuccess }: ImportCSVProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('File harus berformat CSV');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith('.csv')) {
        setError('File harus berformat CSV');
        return;
      }
      setFile(droppedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const response = await transactionsApi.importCSV(file);
      setResult(response.data);
      if (response.data.imported > 0) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Gagal mengimport file');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setError(null);
    onClose();
  };

  const downloadTemplate = () => {
    // Download from public folder
    const a = document.createElement('a');
    a.href = '/template_transaksi.csv';
    a.download = 'template_transaksi.csv';
    a.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Transaksi">
      <div className="space-y-4">
        {/* Template Download */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-700">Format CSV yang didukung:</p>
              <p className="text-xs text-blue-600 mt-1">
                date, amount, type, category, description
              </p>
              <button
                onClick={downloadTemplate}
                className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Download template
              </button>
            </div>
          </div>
        </div>

        {/* File Upload */}
        {!result && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              file ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-primary-500" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600">
                  Drag & drop file CSV atau <span className="text-primary-500 font-medium">pilih file</span>
                </p>
              </>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Import Result */}
        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className={`rounded-xl p-4 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-3">
                {result.success ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                )}
                <div>
                  <p className={`font-semibold ${result.success ? 'text-green-700' : 'text-amber-700'}`}>
                    {result.success ? 'Import Berhasil!' : 'Import Selesai dengan Error'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {result.imported} dari {result.total_rows} transaksi berhasil diimport
                  </p>
                </div>
              </div>
            </div>

            {/* Error Details */}
            {result.errors.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 max-h-48 overflow-y-auto">
                <p className="text-sm font-medium text-gray-700 mb-2">Error pada baris:</p>
                <div className="space-y-2">
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-xs bg-white rounded-lg p-2 border border-gray-200">
                      <p className="text-red-600 font-medium">Baris {err.row}: {err.error}</p>
                      <p className="text-gray-500 mt-1 truncate">
                        Data: {JSON.stringify(err.data)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          {!result ? (
            <>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="flex-1 py-2.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Mengimport...' : 'Import'}
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600"
            >
              Selesai
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
