const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      detail: err.message || 'Validation error'
    });
  }

  if (err.code === 'P2002') {
    // Prisma unique constraint violation
    return res.status(400).json({
      detail: 'Data sudah ada'
    });
  }

  if (err.code === 'P2025') {
    // Prisma record not found
    return res.status(404).json({
      detail: 'Data tidak ditemukan'
    });
  }

  res.status(err.status || 500).json({
    detail: err.message || 'Internal server error'
  });
};

module.exports = errorHandler;
