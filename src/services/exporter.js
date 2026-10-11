const XLSX = require('xlsx');

/**
 * Genera un buffer de Excel normalizado con columnas estandarizadas
 * y métricas de margen calculadas.
 */
function exportToExcelBuffer(products) {
  const rows = products.map(p => ({
    'Código': p.sku || '',
    'Producto / Descripción': p.name || '',
    'Categoría / Rubro': p.category || '',
    'Costo Unitario ($)': p.costPrice || 0,
    'Precio Venta ($)': p.salePrice || 0,
    'Margen Bruto ($)': p.grossMargin || 0,
    '% Margen sobre Venta': (p.marginPercentage || 0) + '%',
    '% Marcación (Markup)': (p.markupPercentage || 0) + '%',
    'Stock (Unidades)': p.stock || 0,
    'Capital Inmovilizado ($)': p.stockValueCost || 0,
    'Venta Potencial ($)': p.stockValueSale || 0,
    'Estado Margen': p.statusLabel || '',
    'Origen': p.source || 'MANUAL'
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ajustar anchos de columnas
  worksheet['!cols'] = [
    { wch: 14 }, // Código
    { wch: 35 }, // Descripción
    { wch: 18 }, // Rubro
    { wch: 16 }, // Costo
    { wch: 16 }, // Precio Venta
    { wch: 16 }, // Margen $
    { wch: 18 }, // % Margen
    { wch: 18 }, // Markup
    { wch: 14 }, // Stock
    { wch: 20 }, // Capital
    { wch: 20 }, // Venta Potencial
    { wch: 18 }, // Estado
    { wch: 12 }  // Origen
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Catálogo Margen');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Genera el payload de integración normalizado para la API de Margen
 */
function formatForMargenApi(products, metadata = {}) {
  return {
    organization: metadata.organization || 'Mi PyME',
    importedAt: new Date().toISOString(),
    sourceType: metadata.sourceType || 'INTEGRATION_API',
    productsCount: products.length,
    products: products.map(p => ({
      externalId: p.sku || p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      pricing: {
        costUnit: p.costPrice,
        priceUnit: p.salePrice,
        currency: metadata.currency || 'ARS',
        grossMargin: p.grossMargin,
        marginPct: p.marginPercentage,
        markupPct: p.markupPercentage
      },
      inventory: {
        stockUnits: p.stock,
        capitalLocked: p.stockValueCost,
        potentialRevenue: p.stockValueSale
      },
      health: {
        status: p.status,
        label: p.statusLabel,
        alerts: p.alerts || []
      }
    }))
  };
}

module.exports = {
  exportToExcelBuffer,
  formatForMargenApi
};
