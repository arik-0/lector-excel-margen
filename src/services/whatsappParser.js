const { parseNumericValue } = require('./excelParser');
const { calculateProductMetrics, calculateSummaryMetrics } = require('./marginCalculator');

/**
 * Limpia encabezados de mensajes de WhatsApp
 * Ej: "[10/10/24, 15:30:12] Proveedor: " o "15:30 - Proveedor: "
 */
function stripWhatsAppMeta(line) {
  let cleaned = line.trim();
  // Formato iOS / Web: [dd/mm/yy, hh:mm:ss] Nombre:
  cleaned = cleaned.replace(/^\[?\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM|am|pm)?\]?\s*[-:]?\s*[^:]+:\s*/i, '');
  // Formato Android: dd/mm/yy, hh:mm - Nombre:
  cleaned = cleaned.replace(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4},?\s+\d{1,2}:\d{2}\s*-\s*[^:]+:\s*/i, '');
  // Viñetas y prefijos
  cleaned = cleaned.replace(/^[\*\-\•\–\—\>]\s*/, '');
  return cleaned.trim();
}

/**
 * Parsea texto no estructurado o mensajes pegados desde WhatsApp.
 * @param {string} text - Contenido del mensaje o chat
 * @param {Object} options - { defaultIsCost, defaultMarkupPercent, minHealthyMargin }
 */
function parseWhatsAppText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return {
      products: [],
      summary: calculateSummaryMetrics([]),
      linesProcessed: 0
    };
  }

  const defaultIsCost = options.defaultIsCost === true; // si el precio único ingresado es costo
  const defaultMarkup = options.defaultMarkupPercent ? Number(options.defaultMarkupPercent) : 30; // 30% por defecto si falta precio

  const lines = text.split(/\r?\n/);
  const products = [];
  let index = 0;

  for (let rawLine of lines) {
    const line = stripWhatsAppMeta(rawLine);
    if (!line || line.length < 3) continue;

    // Ignorar saludos, despedidas o líneas puramente conversacionales
    if (/^(hola|buen d[ií]a|buenas|saludos|adjunto|gracias|av[ií]same|chau|ok|dale|precio de lista)/i.test(line) && !line.includes('$')) {
      continue;
    }

    // 1. Extraer Stock si existe (ej: "x 24 un", "stock: 50", "cant 12", "x10")
    let stock = 0;
    const stockMatch = line.match(/(?:stock|cant|cantidad|unidades|un|x)\s*[:=]?\s*(\d+)(?:\s*(?:un|unid|unidades|u|bulto|caja|pack))?/i);
    if (stockMatch) {
      stock = parseInt(stockMatch[1], 10) || 0;
    }

    // 2. Extraer Costo explícito (ej: "costo $1200", "costo: 1200", "pc: $900", "c/ $500")
    let costPrice = 0;
    const costMatch = line.match(/(?:costo|pc|p\.compra|compra|c\/)\s*[:=]?\s*\$?\s*([\d\.,]+)/i);
    if (costMatch) {
      costPrice = parseNumericValue(costMatch[1]);
    }

    // 3. Extraer Precio de venta explícito (ej: "pv: $1500", "venta: 1800", "pvp: $2000")
    let salePrice = 0;
    const priceExplicitMatch = line.match(/(?:pv|pvp|venta|precio|p\.vta|p\.publico)\s*[:=]?\s*\$?\s*([\d\.,]+)/i);
    if (priceExplicitMatch) {
      salePrice = parseNumericValue(priceExplicitMatch[1]);
    }

    // 4. Si falta precio de venta pero tenemos costo, o no tenemos ninguno:
    if (salePrice === 0) {
      // Buscar todos los valores monetarios de la línea con '$'
      const allMoneyMatches = [...line.matchAll(/\$\s*([\d\.,]+)/g)].map(m => m[1]);

      if (costPrice > 0) {
        // Encontrar un valor con $ que no sea el costo
        const otherMoney = allMoneyMatches.find(m => parseNumericValue(m) !== costPrice);
        if (otherMoney) {
          salePrice = parseNumericValue(otherMoney);
        } else {
          // Si no hay otro valor con $, buscar número suelto antes de las aclaraciones de costo
          const lineWithoutCost = line.replace(/(?:costo|pc|p\.compra|compra|c\/)\s*[:=]?\s*\$?\s*[\d\.,]+/i, '');
          const otherNumMatch = lineWithoutCost.match(/\$?\s*([\d\.,]{2,})/);
          if (otherNumMatch && parseNumericValue(otherNumMatch[1]) !== costPrice) {
            salePrice = parseNumericValue(otherNumMatch[1]);
          } else {
            salePrice = Number((costPrice * (1 + defaultMarkup / 100)).toFixed(2));
          }
        }
      } else {
        // No tenemos costo ni precio explícito
        if (allMoneyMatches.length >= 2) {
          salePrice = parseNumericValue(allMoneyMatches[0]);
          costPrice = parseNumericValue(allMoneyMatches[1]);
        } else if (allMoneyMatches.length === 1) {
          const val = parseNumericValue(allMoneyMatches[0]);
          if (defaultIsCost) {
            costPrice = val;
            salePrice = Number((val * (1 + defaultMarkup / 100)).toFixed(2));
          } else {
            salePrice = val;
          }
        } else {
          // Intentar buscar número al final de la línea: "Yerba Mate 1kg 1800"
          const trailingNumMatch = line.match(/[\s:–-]\s*([\d\.,]{2,})\s*$/);
          if (trailingNumMatch) {
            const val = parseNumericValue(trailingNumMatch[1]);
            if (val > 0) {
              if (defaultIsCost) {
                costPrice = val;
                salePrice = Number((val * (1 + defaultMarkup / 100)).toFixed(2));
              } else {
                salePrice = val;
              }
            }
          }
        }
      }
    }

    // 5. Extraer nombre del producto limpiando las partes numéricas / metadatos
    let cleanName = line
      .replace(/(?:stock|cant|cantidad|unidades|un|x)\s*[:=]?\s*(\d+)(?:\s*(?:un|unid|unidades|u|bulto|caja|pack))?/gi, '')
      .replace(/(?:costo|pc|p\.compra|compra|c\/)\s*[:=]?\s*\$?\s*[\d\.,]+/gi, '')
      .replace(/(?:pv|pvp|venta|precio|p\.vta|p\.publico)\s*[:=]?\s*\$?\s*[\d\.,]+/gi, '')
      .replace(/\$\s*[\d\.,]+/g, '')
      .replace(/[\(\)\[\]\|]/g, ' ')
      .replace(/[\s:–-]+$/, '')
      .trim();

    // Extraer SKU si viene entre corchetes o con prefijo "cod:"
    let sku = '';
    const skuMatch = line.match(/(?:c[oó]d|sku|art|id)[:.]?\s*([A-Za-z0-9\-_]+)/i);
    if (skuMatch) {
      sku = skuMatch[1];
    }

    if (cleanName.length >= 2 && (salePrice > 0 || costPrice > 0)) {
      index++;
      const product = calculateProductMetrics({
        id: `wpp-${index}`,
        sku: sku || `WPP-${String(index).padStart(3, '0')}`,
        name: cleanName,
        category: 'WhatsApp / Ingesta Rápida',
        costPrice,
        salePrice,
        stock,
        source: 'WHATSAPP',
        rawText: rawLine
      }, { minHealthyMargin: options.minHealthyMargin });

      products.push(product);
    }
  }

  const summary = calculateSummaryMetrics(products);

  return {
    linesProcessed: lines.length,
    productsDetected: products.length,
    products,
    summary
  };
}

module.exports = {
  parseWhatsAppText,
  stripWhatsAppMeta
};
