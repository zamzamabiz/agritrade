import multer from 'multer';
import path from 'path';
import uploadConfig from '../config/uploadConfig.js';

const validateMimeType = (mimeType) => {
  if (!uploadConfig.security.validateMimeTypes) {
    return true;
  }
  
  const allowedMimeTypes = uploadConfig.security.allowedMimeTypes;
  return allowedMimeTypes.includes(mimeType);
};

const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = uploadConfig.upload.allowedExtensions;
  
  // Check extension
  if (!allowedExtensions.includes(extension)) {
    const error = new Error(
      `Invalid file type: ${extension}. ` +
      `Allowed types: ${allowedExtensions.join(', ')}`
    );
    error.status = 400;
    return callback(error, false);
  }
  
  // Check MIME type if enabled
  if (!validateMimeType(file.mimetype)) {
    const error = new Error(
      `Invalid MIME type: ${file.mimetype}. ` +
      `File extension doesn't match content.`
    );
    error.status = 400;
    return callback(error, false);
  }
  
  // File is valid
  callback(null, true);
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: uploadConfig.upload.maxFileSize,
    files: uploadConfig.upload.maxFiles
  },
  fileFilter: fileFilter
});

const handleUploadError = (error, req, res, next) => {
  if (error) {
    console.error('📤 Upload Error:', {
      message: error.message,
      code: error.code,
      field: error.field,
      timestamp: new Date().toISOString()
    });
    
    // Multer-specific errors
    if (error instanceof multer.MulterError) {
      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          return res.status(400).json({
            success: false,
            message: `File size exceeds limit. Maximum: ${uploadConfig.upload.maxFileSize / (1024 * 1024)}MB`
          });
          
        case 'LIMIT_FILE_COUNT':
          return res.status(400).json({
            success: false,
            message: `Too many files. Maximum: ${uploadConfig.upload.maxFiles} file per upload`
          });
          
        case 'LIMIT_UNEXPECTED_FILE':
          return res.status(400).json({
            success: false,
            message: `Unexpected file field. Use "${uploadConfig.upload.fieldName}" as field name`
          });
          
        default:
          return res.status(400).json({
            success: false,
            message: `Upload error: ${error.message}`
          });
      }
    }
    
    // Custom validation errors
    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    // Unknown errors
    return res.status(500).json({
      success: false,
      message: 'Internal server error during file upload',
      error: uploadConfig.errors.verbose ? error.message : undefined
    });
  }
  
  next();
};

export {
  upload,
  handleUploadError
};