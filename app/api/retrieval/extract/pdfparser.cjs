// This is a CommonJS module for PDF parsing
const pdfParse = require('pdf-parse/lib/pdf-parse');

/**
 * Parse a PDF buffer and extract text
 * @param {Buffer} buffer PDF file buffer
 * @returns {Promise<Object>} Parsed PDF data
 */
async function parsePdf(buffer) {
  try {
    return await pdfParse(buffer);
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

// Export using module.exports for CommonJS
module.exports = {
  parsePdf
};

// Also make it compatible with ES Module imports
module.exports.default = module.exports; 