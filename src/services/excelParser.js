const XLSX = require('xlsx');
const { calculateProductMetrics, calculateSummaryMetrics } = require('./marginCalculator');

/**
 * Normaliza valores numéricos que vienen con signos monetarios, 
 * comas o puntos decimales típicos de Excel y PyMEs latinoamericanas.
 */
function parseNumericValue(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  // Quitar símbolos de moneda, espacios
  str = str.replace(/[$€USDARS\s]/gi, '');

  // Detectar formato: si tiene punto y coma, determinar cuál es decimal
  if (str.includes('.') && str.includes(',')) {
    // Caso 1.250,50 (formato AR/ES)
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Caso 1,250.50 (formato US)
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Si solo tiene coma, típicamente es decimal: 1250,50 -> 1250.50
    if (/^\d{1,3},\d{3}$/.test(str)) {
      str = str.replace(',', '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (str.includes('.')) {
    // Si tiene múltiples puntos: 1.250.000 -> miles
    if (str.split('.').length > 2) {
      str = str.replace(/\./g, '');
    } else if (/^\d{1,3}\.\d{3}$/.test(str)) {
      // Caso típico latinoamericano: 1.450 o 2.100 -> miles
      str = str.replace(/\./g, '');
    }
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Diccionario de patrones para detección automática de columnas.
 */
const COLUMN_PATTERNS = {
  name: [
    /descripci[oó]n/i, /producto/i, /detalle/i, /art[ií]culo/i, /nombre/i, 
    /concepto/i, /item/i, /denominaci[oó]n/i, /t[ií]tulo/i
  ],
  sku: [
    /^c[oó]d/i, /c[oó]digo/i, /sku/i, /ean/i, /referencia/i, /ref/i, 
    /c[oó]d[\.\s_\-]*art/i, /id/i, /c[oó]d[\.\s_\-]*barra/i
  ],
  costPrice: [
    /costo/i, /precio[\s_\-]*costo/i, /^pc$/i, /p[\.\s_\-]*compra/i, 
    /costo[\s_\-]*unitario/i, /precio[\s_\-]*lista/i, /costo[\s_\-]*reposici[oó]n/i, 
    /costo[\s_\-]*neto/i, /valor[\s_\-]*compra/i, /cost/i
  ],
  salePrice: [
    /precio[\s_\-]*venta/i, /^pv$/i, /^pvp$/i, /precio[\s_\-]*p[uú]blico/i, 
    /precio[\s_\-]*final/i, /p[\.\s_\-]*vta/i, /precio[\s_\-]*sugerido/i, 
    /precio[\s_\-]*mostrador/i, /precio[\s_\-]*pub/i, /^venta$/i, /^precio$/i
  ],
  category: [
    /rubro/i, /categor[ií]a/i, /familia/i, /l[ií]nea/i, /grupo/i, 
    /depto/i, /departamento/i, /secci[oó]n/i, /subrubro/i
  ],
  stock: [
    /stock/i, /cantidad/i, /^cant$/i, /existencia/i, /disponible/i, 
    /unidades/i, /saldo/i, /inventario/i
  ]
};

/**
 * Encuentra automáticamente el mejor mapeo para cada columna analizando el encabezado.
 */
function detectColumnMapping(headers) {
  const mapping = {};
  const usedCols = new Set();

  for (const [targetField, patterns] of Object.entries(COLUMN_PATTERNS)) {
    let bestMatch = null;
    let bestScore = -1;

    headers.forEach((header, index) => {
      if (usedCols.has(index)) return;
      const cleanHeader = String(header || '').trim();

      for (const pattern of patterns) {
        if (pattern.test(cleanHeader)) {
          // Si coincide exactamente da mayor puntuación
          const score = pattern.source.length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { header: cleanHeader, index };
          }
        }
      }
    });

    if (bestMatch) {
      mapping[targetField] = bestMatch.header;
      usedCols.add(bestMatch.index);
    }
  }

  return mapping;
}

/**
 * Escanea las primeras filas para encontrar la verdadera fila de encabezados
 * (útil si hay títulos de empresa o filas en blanco antes de la tabla).
 */
function findHeaderRow(rows, maxScan = 15) {
  let bestRowIndex = 0;
  let maxMatchedHeaders = 0;

  const allPatterns = [
    ...COLUMN_PATTERNS.name,
    ...COLUMN_PATTERNS.costPrice,
    ...COLUMN_PATTERNS.salePrice,
    ...COLUMN_PATTERNS.sku,
    ...COLUMN_PATTERNS.category,
    ...COLUMN_PATTERNS.stock
  ];

  for (let r = 0; r < Math.min(rows.length, maxScan); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    let matches = 0;
    row.forEach(cell => {
      const cellText = String(cell || '').trim();
      if (!cellText) return;
      if (allPatterns.some(p => p.test(cellText))) {
        matches++;
      }
    });

    if (matches > maxMatchedHeaders) {
      maxMatchedHeaders = matches;
      bestRowIndex = r;
    }
  }

  return bestRowIndex;
}

/**
 * Parsea un buffer de archivo Excel (XLSX, XLS, CSV).
 * @param {Buffer} buffer - Archivo en memoria
 * @param {Object} options - { sheetName, customMapping, minHealthyMargin }
 */
function parseExcelBuffer(buffer, options = {}) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas de cálculo.');
  }

  const selectedSheet = options.sheetName && sheetNames.includes(options.sheetName)
    ? options.sheetName
    : sheetNames[0];

  const worksheet = workbook.Sheets[selectedSheet];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rawRows.length === 0) {
    return {
      sheetNames,
      selectedSheet,
      headers: [],
      mapping: {},
      products: [],
      summary: calculateSummaryMetrics([])
    };
  }

  // Detectar la fila donde están los encabezados
  const headerRowIdx = findHeaderRow(rawRows);
  const rawHeaders = rawRows[headerRowIdx].map(h => String(h || '').trim());
  const dataRows = rawRows.slice(headerRowIdx + 1);

  // Mapeo automático de columnas o usar el personalizado si fue provisto
  const autoMapping = detectColumnMapping(rawHeaders);
  const mapping = options.customMapping || autoMapping;

  // Extraer productos
  const products = [];

  dataRows.forEach((row, rowIdx) => {
    // Si la fila está totalmente vacía, omitir
    const hasContent = row.some(cell => String(cell || '').trim() !== '');
    if (!hasContent) return;

    const rowObj = {};
    rawHeaders.forEach((header, colIdx) => {
      if (header) {
        rowObj[header] = row[colIdx];
      }
    });

    // Mapear campos normalizados
    const rawName = mapping.name ? rowObj[mapping.name] : (rowObj['descripcion'] || rowObj['producto'] || row[1] || '');
    const name = String(rawName || '').trim();

    // Si no tiene nombre ni código, no parece un producto válido
    const rawSku = mapping.sku ? rowObj[mapping.sku] : (rowObj['codigo'] || row[0] || '');
    const sku = String(rawSku || '').trim();

    if (!name && !sku) return;

    const rawCost = mapping.costPrice ? rowObj[mapping.costPrice] : (rowObj['costo'] || 0);
    const rawPrice = mapping.salePrice ? rowObj[mapping.salePrice] : (rowObj['precio'] || 0);
    const rawStock = mapping.stock ? rowObj[mapping.stock] : (rowObj['stock'] || 0);
    const rawCategory = mapping.category ? rowObj[mapping.category] : (rowObj['rubro'] || rowObj['categoria'] || 'General');

    const costPrice = parseNumericValue(rawCost);
    const salePrice = parseNumericValue(rawPrice);
    const stock = Math.max(0, Math.floor(parseNumericValue(rawStock)));
    const category = String(rawCategory || 'General').trim() || 'General';

    const product = calculateProductMetrics({
      id: `p-${rowIdx + 1}`,
      sku: sku || `ART-${rowIdx + 1}`,
      name: name || `Producto sin descripción #${rowIdx + 1}`,
      category,
      costPrice,
      salePrice,
      stock,
      source: 'EXCEL',
      rawRow: rowObj
    }, { minHealthyMargin: options.minHealthyMargin });

    products.push(product);
  });

  const summary = calculateSummaryMetrics(products);

  return {
    sheetNames,
    selectedSheet,
    totalRowsScanned: rawRows.length,
    headerRowIndex: headerRowIdx + 1,
    headers: rawHeaders.filter(Boolean),
    mapping,
    autoMapping,
    products,
    summary
  };
}

module.exports = {
  parseExcelBuffer,
  parseNumericValue,
  detectColumnMapping,
  COLUMN_PATTERNS
};
