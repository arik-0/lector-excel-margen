const express = require('express');
const { calculateProductMetrics, calculateSummaryMetrics } = require('../services/marginCalculator');
const { exportToExcelBuffer, formatForMargenApi } = require('../services/exporter');

const router = express.Router();

/**
 * POST /api/v1/products/normalize
 * Recalcula métricas para una lista de productos editados manualmente en la UI.
 */
router.post('/normalize', (req, res) => {
  try {
    const { products, minHealthyMargin } = req.body;

    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Se esperaba un array de productos en el campo "products".' });
    }

    const normalizedProducts = products.map((item, idx) => {
      return calculateProductMetrics({
        id: item.id || `p-${idx + 1}`,
        sku: item.sku || `SKU-${idx + 1}`,
        name: item.name || '',
        category: item.category || 'General',
        costPrice: Number(item.costPrice) || 0,
        salePrice: Number(item.salePrice) || 0,
        stock: Number(item.stock) || 0,
        source: item.source || 'MANUAL'
      }, { minHealthyMargin });
    });

    const summary = calculateSummaryMetrics(normalizedProducts);

    return res.json({
      success: true,
      products: normalizedProducts,
      summary
    });
  } catch (error) {
    console.error('Error normalizando productos:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/products/export-excel
 * Descarga los productos procesados en formato Excel estándar.
 */
router.post('/export-excel', (req, res) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No hay productos para exportar.' });
    }

    const buffer = exportToExcelBuffer(products);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="catalogo_margen_gestion.xlsx"');
    return res.send(buffer);
  } catch (error) {
    console.error('Error exportando Excel:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/products/format-margen
 * Devuelve el payload estructurado listo para la API de Margen.
 */
router.post('/format-margen', (req, res) => {
  try {
    const { products, metadata } = req.body;

    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Se esperaba un array de productos.' });
    }

    const payload = formatForMargenApi(products, metadata || {});
    return res.json({
      success: true,
      data: payload
    });
  } catch (error) {
    console.error('Error formateando para Margen:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
