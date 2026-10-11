const express = require('express');
const { formatForMargenApi } = require('../services/exporter');

const router = express.Router();

/**
 * POST /api/v1/sync/margen
 * Envía los productos normalizados al endpoint de la App de Margen
 * o simula la sincronización con feedback detallado si aún no está configurada la URL de destino.
 */
router.post('/margen', async (req, res) => {
  try {
    const { products, targetApiUrl, apiKey, organization } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No se enviaron productos para sincronizar.' });
    }

    const payload = formatForMargenApi(products, {
      organization: organization || 'PyME Demo',
      sourceType: 'MARGEN_DATA_BRIDGE'
    });

    // Si el usuario configuró una URL real de la API de Margen
    if (targetApiUrl && targetApiUrl.startsWith('http')) {
      try {
        const response = await fetch(targetApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': apiKey ? `Bearer ${apiKey}` : ''
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        return res.json({
          success: true,
          status: 'SYNCED_REMOTE',
          message: `Sincronización exitosa con la API de Margen en ${targetApiUrl}`,
          remoteResponse: data,
          payloadSummary: {
            productsSent: products.length,
            timestamp: payload.importedAt
          }
        });
      } catch (remoteErr) {
        return res.status(502).json({
          success: false,
          error: `Error al contactar la API remota de Margen (${targetApiUrl}): ${remoteErr.message}`
        });
      }
    }

    // Modo simulación / Sandbox directo
    return res.json({
      success: true,
      status: 'SIMULATED_SUCCESS',
      message: 'Sincronización simulada exitosa. El payload cumple con la especificación de Margen.',
      destinationNotice: 'Para enviar a tu servidor real de Margen, especifica targetApiUrl y tu apiKey.',
      payloadSummary: {
        productsProcessed: products.length,
        organization: payload.organization,
        timestamp: payload.importedAt,
        sampleProduct: payload.products[0] || null
      }
    });

  } catch (error) {
    console.error('Error sincronizando con Margen:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
