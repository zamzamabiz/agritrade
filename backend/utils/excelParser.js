import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

class ExcelParser {
  static async parseBuffer(buffer, originalName) {
    try {
      const ext = path.extname(originalName).toLowerCase();
      console.log(`📄 Parsing file: ${originalName} (${ext})`);
      // Ensure buffer is a Node.js Buffer
      if (buffer && !(Buffer.isBuffer(buffer))) {
        if (buffer instanceof Uint8Array) {
          buffer = Buffer.from(buffer);
        } else if (Array.isArray(buffer)) {
          buffer = Buffer.from(buffer);
        } else if (typeof buffer === 'object' && buffer.data) {
          buffer = Buffer.from(buffer.data);
        } else if (typeof ArrayBuffer !== 'undefined' && buffer instanceof ArrayBuffer) {
          buffer = Buffer.from(new Uint8Array(buffer));
        } else {
          throw new Error('Uploaded file buffer is not valid.');
        }
      }

      let workbook;
      // xlsx library supports both .xls and .xlsx formats natively
      if (ext === '.csv') {
        // For CSV files, specify the type as string
        const csvData = buffer.toString('utf-8');
        workbook = XLSX.read(csvData, { type: 'string', raw: true });
      } else {
        // For .xls and .xlsx files, read as binary
        workbook = XLSX.read(buffer, { 
          type: 'buffer', 
          cellDates: true,
          cellNF: false,
          raw: false
        });
      }

      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('File has no worksheets');
      }

      // Get first worksheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert worksheet to JSON (first row as headers)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: null,
        blankrows: false
      });

      console.log(`📊 Raw rows parsed: ${jsonData.length}`);

      if (jsonData.length === 0) {
        throw new Error('File has no data rows');
      }

      // Log headers
      if (jsonData.length > 0) {
        const headers = Object.keys(jsonData[0]);
        console.log(`🧾 Detected headers (${headers.length}):`, headers);
      }

      // Convert to standardized format (async mapping)
      const parsedData = await Promise.all(
        jsonData.map(async record => this._processRecord(await this._mapFields(record)))
      );
      const filteredData = parsedData.filter(record => record !== null);
      console.log(`✅ Valid rows after processing: ${filteredData.length}`);
      if (filteredData.length > 0) {
        console.log('🔎 Sample parsed record:', filteredData[0]);
      }
      return filteredData;

    } catch (error) {
      throw new Error(`Failed to parse file: ${error.message}`);
    }
  }

  static async _mapFields(record) {
    // Load mapping config only once
    if (!this._columnMappings) {
      const fs = await import('fs');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const configPath = path.join(__dirname, '../config/excelColumnMappings.json');
      const configRaw = await fs.promises.readFile(configPath, 'utf-8');
      this._columnMappings = JSON.parse(configRaw);
      this._knownFields = Object.keys(this._columnMappings);
    }

    const mappedRecord = {};
    Object.keys(record).forEach((excelHeader) => {
      if (!excelHeader || record[excelHeader] === undefined) return;
      const headerClean = excelHeader.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      let mappedKey = null;

      // Try direct and config-based mapping
      for (const [stdField, variants] of Object.entries(this._columnMappings)) {
        for (const variant of variants) {
          const variantClean = variant.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          if (headerClean === variantClean) {
            mappedKey = stdField;
            break;
          }
        }
        if (mappedKey) break;
      }

      // Fuzzy match (simple contains)
      if (!mappedKey) {
        for (const [stdField, variants] of Object.entries(this._columnMappings)) {
          for (const variant of variants) {
            const variantClean = variant.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (headerClean.includes(variantClean) || variantClean.includes(headerClean)) {
              mappedKey = stdField;
              break;
            }
          }
          if (mappedKey) break;
        }
      }

      if (!mappedKey) {
        console.warn(`⚠️  Unknown Excel column will be ignored: "${excelHeader}"`);
        return;
      }
      mappedRecord[mappedKey] = record[excelHeader];
    });
    return mappedRecord;
  }

  static _processRecord(record) {
    try {
      const processed = { ...record };

      // Process date - handle DD/MM/YYYY format if present
      if (processed.date) {
        processed.date = this._parseDate(processed.date);
        if (!processed.date || isNaN(processed.date.getTime())) {
          console.warn(`Invalid date: ${record.date}`);
          processed.date = null; // allow fallback to period date
        }
      }

      // Process quantity if present
      if (processed.quantity !== undefined && processed.quantity !== null && processed.quantity !== '') {
        processed.quantity = Number(processed.quantity);
        if (isNaN(processed.quantity)) {
          console.warn(`Invalid quantity: ${record.quantity}`);
          processed.quantity = null;
        }
      }

      // Required item field fallback
      if (!processed.item || processed.item.toString().trim() === '') {
        processed.item = 'Unknown';
      }

      // Extract price from description (if exists)
      if (processed.item_description) {
        const priceMatch = processed.item_description.match(/US\$?\s*(\d+\.?\d*)\s*\/?KG/i);
        if (priceMatch) {
          processed.price_per_kg = parseFloat(priceMatch[1]);
        }
      }

      // Set defaults
      if (!processed.uom) processed.uom = null;
      if (!processed.agent_name) processed.agent_name = null;
      if (!processed.agent_number) processed.agent_number = null;
      if (!processed.terminal_sheds) processed.terminal_sheds = null;
      return processed;

    } catch (error) {
      console.error(`Error processing record: ${error.message}`);
      return null;
    }
  }

  static _parseDate(dateInput) {
    // If already Date object
    if (dateInput instanceof Date) {
      return dateInput;
    }

    // If Excel serial number
    if (typeof dateInput === 'number') {
      return this._excelDateToJSDate(dateInput);
    }

    // If string - handle DD/MM/YYYY format
    if (typeof dateInput === 'string') {
      const dateStr = dateInput.toString().trim();

      // Try DD/MM/YYYY pattern (with optional time)
      const ddMmYyyyPattern = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+\d{1,2}:\d{2}:\d{2})?$/;
      const match = dateStr.match(ddMmYyyyPattern);

      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);

        // Basic validation
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
          return new Date(year, month - 1, day);
        }
      }

      // Try other common formats as fallback
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  }

  static _excelDateToJSDate(serial) {
    const utcDays = Math.floor(serial - 25569);
    const dateInfo = new Date(utcDays * 86400 * 1000);

    const fractionalDay = serial - Math.floor(serial) + 0.0000001;
    let totalSeconds = Math.floor(86400 * fractionalDay);

    const seconds = totalSeconds % 60;
    totalSeconds -= seconds;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60) % 60;

    return new Date(
      dateInfo.getFullYear(),
      dateInfo.getMonth(),
      dateInfo.getDate(),
      hours,
      minutes,
      seconds
    );
  }

  static validateData(data, periodDate) {
    const errors = [];
    const validRecords = [];

    data.forEach((record, index) => {
      const rowErrors = [];

      // Fallback to periodDate if date is missing or invalid
      let parsedDate = null;
      if (record.date && !isNaN(new Date(record.date).getTime())) {
        parsedDate = new Date(record.date);
      } else if (periodDate) {
        parsedDate = new Date(periodDate);
        record.date = parsedDate;
      }
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        rowErrors.push('Invalid or missing date');
      }

      if (!record.quantity || isNaN(record.quantity) || record.quantity <= 0) {
        rowErrors.push('Invalid quantity');
      }

      if (rowErrors.length === 0) {
        validRecords.push(record);
      } else {
        errors.push({
          row: index + 2, // +2 for Excel row (header is row 1)
          errors: rowErrors,
          data: record
        });
        // Log each error
        console.warn(`Row ${index + 2} validation errors: ${rowErrors.join(', ')} | Data:`, record);
      }
    });

    // Log summary
    console.log(`Validation complete. Valid rows: ${validRecords.length}, Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Sample errors:', errors.slice(0, 5));
    }

    return {
      validRecords,
      errors,
      totalRecords: data.length,
      validCount: validRecords.length,
      errorCount: errors.length
    };
  }
  
  static getSampleStructure() {
    return {
      required_fields: ['date', 'hs_code', 'item', 'quantity'],
      optional_fields: [
        'trade_type', 'origin', 'exporter_overseas',
        'item_description', 'ntn', 'importer_pak', 'port_of_shipment',
        'uom', 'agent'
      ],
      date_format: 'DD/MM/YYYY',
      examples: {
        valid_date: '01/10/2025',
        valid_record: {
          trade_type: 'Import',
          date: '01/10/2025',
          hs_code: '904.111',
          origin: 'Brazil',
          exporter_overseas: '2 J COMERCIAL LTDA',
          item: 'PEPPER BLACK',
          item_description: 'BRAZIL BLACK PEPPER @ US$ 2.54/KG',
          quantity: 27000,
          uom: 'KG',
          agent: 'Unknown'
        }
      }
    };
  }
}

export default ExcelParser;