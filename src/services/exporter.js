const XLSX = require('xlsx');

/**
 * Genera un buffer de Excel normalizado con columnas estandarizadas,
 * métricas de margen calculadas y opcionalmente hojas de Egresos y Estado de Resultados (P&L).
 */
function exportToExcelBuffer(products, expenses = [], pAndLSummary = null) {
  const workbook = XLSX.utils.book_new();

  // HOJA 1: SERVICIOS / PRODUCTOS CONSOLIDADOS
  const productRows = products.map(p => ({
    'Código': p.sku || '',
    'Producto / Servicio': p.name || '',
    'Categoría': p.category || '',
    'Tipo': p.offerType || 'producto',
    'Duración (Horas)': p.durationHours || '-',
    'Costo Unitario ($)': p.costPrice || 0,
    'Precio Venta ($)': p.salePrice || 0,
    'Margen Bruto ($)': p.grossMargin || 0,
    '% Margen sobre Venta': (p.marginPercentage || 0) + '%',
    '% Marcación (Markup)': (p.markupPercentage || 0) + '%',
    'Unidades Vendidas / Stock': p.stock || 0,
    'Facturación Total ($)': p.totalRevenue || p.stockValueSale || 0,
    'Costo Total ($)': p.totalCost || p.stockValueCost || 0,
    'Estado Margen': p.statusLabel || '',
    'Prestadores': Array.isArray(p.providers) ? p.providers.join(', ') : ''
  }));

  const wsProducts = XLSX.utils.json_to_sheet(productRows);
  wsProducts['!cols'] = [
    { wch: 14 }, // Código
    { wch: 38 }, // Descripción
    { wch: 20 }, // Categoría
    { wch: 12 }, // Tipo
    { wch: 16 }, // Duración
    { wch: 16 }, // Costo
    { wch: 16 }, // Precio Venta
    { wch: 16 }, // Margen $
    { wch: 18 }, // % Margen
    { wch: 18 }, // Markup
    { wch: 16 }, // Unidades
    { wch: 20 }, // Facturación
    { wch: 20 }, // Costo Total
    { wch: 18 }, // Estado
    { wch: 28 }  // Prestadores
  ];
  XLSX.utils.book_append_sheet(workbook, wsProducts, '1. Servicios y Ventas');

  // HOJA 2: EGRESOS CLASIFICADOS (Si existen)
  if (Array.isArray(expenses) && expenses.length > 0) {
    const expenseRows = expenses.map(e => ({
      'ID': e.id,
      'Fecha': e.date,
      'Concepto / Comprobante': e.concept,
      'Importe ($)': e.amount,
      'Medio de Pago': e.paymentMethod,
      'Tipo de Costo': e.isFixed ? 'COSTO FIJO' : 'COSTO VARIABLE',
      'Categoría Margen': e.category,
      'Detalle Clasificación': e.label
    }));

    const wsExpenses = XLSX.utils.json_to_sheet(expenseRows);
    wsExpenses['!cols'] = [
      { wch: 10 },
      { wch: 18 },
      { wch: 40 },
      { wch: 16 },
      { wch: 22 },
      { wch: 16 },
      { wch: 24 },
      { wch: 32 }
    ];
    XLSX.utils.book_append_sheet(workbook, wsExpenses, '2. Egresos Clasificados');
  }

  // HOJA 3: ESTADO DE RESULTADOS (P&L DE GESTIÓN MARGEN)
  if (pAndLSummary) {
    const plRows = [
      { 'Línea de Gestión': '(+) Facturación Bruta Total', 'Monto ($)': pAndLSummary.grossRevenue, '% S/ Venta Neta': '-' },
      { 'Línea de Gestión': '(-) Descuentos Comerciales y Promociones', 'Monto ($)': -pAndLSummary.discounts, '% S/ Venta Neta': '-' },
      { 'Línea de Gestión': '(=) FACTURACIÓN NETA REAL', 'Monto ($)': pAndLSummary.netRevenue, '% S/ Venta Neta': '100.0%' },
      { 'Línea de Gestión': '---------------------------------------------------', 'Monto ($)': '', '% S/ Venta Neta': '' },
      { 'Línea de Gestión': '(-) Costo Variable Directo de Servicios (CVT)', 'Monto ($)': -pAndLSummary.directVariableCost, '% S/ Venta Neta': ((pAndLSummary.directVariableCost / pAndLSummary.netRevenue) * 100).toFixed(1) + '%' },
      { 'Línea de Gestión': '(-) Costos Variables Operativos (Insumos + Máquinas + Honorarios)', 'Monto ($)': -pAndLSummary.operationalVariableCosts, '% S/ Venta Neta': ((pAndLSummary.operationalVariableCosts / pAndLSummary.netRevenue) * 100).toFixed(1) + '%' },
      { 'Línea de Gestión': '(=) MARGEN DE CONTRIBUCIÓN TOTAL', 'Monto ($)': pAndLSummary.contributionMargin, '% S/ Venta Neta': pAndLSummary.contributionMarginPct + '%' },
      { 'Línea de Gestión': '---------------------------------------------------', 'Monto ($)': '', '% S/ Venta Neta': '' },
      { 'Línea de Gestión': '(-) Costos Fijos Totales (Alquiler local, sueldos base, marketing, ERP)', 'Monto ($)': -pAndLSummary.totalFixedCosts, '% S/ Venta Neta': ((pAndLSummary.totalFixedCosts / pAndLSummary.netRevenue) * 100).toFixed(1) + '%' },
      { 'Línea de Gestión': '(=) RESULTADO OPERATIVO NETO REAL (EBITDA)', 'Monto ($)': pAndLSummary.netOperatingIncome, '% S/ Venta Neta': pAndLSummary.netMarginPct + '%' }
    ];

    const wsPL = XLSX.utils.json_to_sheet(plRows);
    wsPL['!cols'] = [
      { wch: 65 },
      { wch: 18 },
      { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(workbook, wsPL, '3. Estado de Resultados (P&L)');
  }

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
