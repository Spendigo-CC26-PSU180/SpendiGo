# backend/ml/model_loader.py
import os
import joblib
import numpy as np
from pathlib import Path

ML_DIR = Path(__file__).parent

_model = None
_scaler = None
_scaler_target = None
_tf_available = None


def _check_tensorflow():
    """Check if TensorFlow is available."""
    global _tf_available
    if _tf_available is None:
        try:
            import tensorflow as tf
            _tf_available = True
        except ImportError as e:
            print(f"TensorFlow not available: {e}")
            _tf_available = False
        except Exception as e:
            print(f"TensorFlow error: {e}")
            _tf_available = False
    return _tf_available


def get_model():
    """Load and cache the LSTM model (singleton pattern)."""
    global _model
    if _model is None:
        if not _check_tensorflow():
            raise RuntimeError("TensorFlow tidak tersedia di server ini")

        model_path = ML_DIR / "lstm_model_best.keras"
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")

        # Import tensorflow here to avoid slow startup if not needed
        import tensorflow as tf
        _model = tf.keras.models.load_model(str(model_path))
    return _model


def get_scaler():
    """Load and cache the input scaler (singleton pattern)."""
    global _scaler
    if _scaler is None:
        scaler_path = ML_DIR / "scaler.pkl"
        if not scaler_path.exists():
            raise FileNotFoundError(f"Scaler not found: {scaler_path}")
        _scaler = joblib.load(str(scaler_path))
    return _scaler


def get_scaler_target():
    """Load and cache the target scaler for inverse transform (singleton pattern)."""
    global _scaler_target
    if _scaler_target is None:
        scaler_path = ML_DIR / "scaler_target.pkl"
        if not scaler_path.exists():
            raise FileNotFoundError(f"Scaler target not found: {scaler_path}")
        _scaler_target = joblib.load(str(scaler_path))
    return _scaler_target


# Input columns - ORDER MATTERS! Must match training data exactly
INPUT_COLS = [
    'total_expense',       # total pengeluaran bulan itu
    'total_income',        # total pemasukan bulan itu
    'net',                 # total_income - total_expense
    'frekuensi_exp',       # jumlah transaksi expense bulan itu
    'avg_expense',         # rata-rata per transaksi expense
    'is_ramadan',          # 1 kalau bulan Maret/April, else 0
    'is_harbolnas_month'   # 1 kalau ada 11/11 atau 12/12 di bulan itu, else 0
]

LOOKBACK = 2  # 2 bulan historis required for prediction
