const config = {
  upload: {
    fieldName: 'file',
    allowedExtensions: ['.xlsx', '.xls', '.csv'],
    maxFileSize: 50 * 1024 * 1024, // 50MB in bytes
    maxFiles: 1,    
  },
  security: {
    validateMimeTypes: true,
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ],
  },
};

export default config;