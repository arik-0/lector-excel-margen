const express = require('express');
const multer = require('multer');
const { parseExcelBuffer } = require('../services/excelParser');
const { parseWhatsAppText } = require('../services/whatsappParser');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

/**
 * POST /api/v1/import/excel
 * Carga un archivo Excel/CSV, detecta columnas automáticamente y calcula márgenes.
 */
router.post('/excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo Excel (.xlsx, .xls, .csv).' });
    }

    let customMapping = null;
    if (req.body.customMapping) {
      try {
        customMapping = typeof req.body.customMapping === 'string'
          ? JSON.parse(req.body.customMapping)
          : req.body.customMapping;
      } catch (e) {
        console.warn('Error parseando customMapping:', e.message);
      }
    }

    const options = {
      sheetName: req.body.sheetName,
      customMapping,
      minHealthyMargin: req.body.minHealthyMargin ? Number(req.body.minHealthyMargin) : 15
    };

    const result = parseExcelBuffer(req.file.buffer, options);

    return res.json({
      success: true,
      filename: req.file.originalname,
      size: req.file.size,
      ...result
    });
  } catch (error) {
    console.error('Error procesando Excel:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al interpretar el archivo Excel: ' + error.message
    });
  }
});

/**
 * POST /api/v1/import/whatsapp
 * Interpreta texto copiado de WhatsApp o listas informales de proveedores.
 */
router.post('/whatsapp', (req, res) => {
  try {
    const { text, defaultIsCost, defaultMarkupPercent, minHealthyMargin } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'El campo "text" es requerido y no puede estar vacío.' });
    }

    const options = {
      defaultIsCost: Boolean(defaultIsCost),
      defaultMarkupPercent: defaultMarkupPercent ? Number(defaultMarkupPercent) : 30,
      minHealthyMargin: minHealthyMargin ? Number(minHealthyMargin) : 15
    };

    const result = parseWhatsAppText(text, options);

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error procesando texto de WhatsApp:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al interpretar el mensaje: ' + error.message
    });
  }
});

/**
 * GET /api/v1/import/samples
 * Provee datos de ejemplo listos para probar sin necesidad de buscar archivos.
 */
router.get('/samples', (req, res) => {
  const sampleWhatsAppText = `[10/10/24, 09:15] Distribuidora Central: Hola! Te paso la lista con los precios actualizados de esta semana:
- Coca Cola 1.5L x 24 un: $ 1.450 (Costo: $ 980)
- Yerba Mate Playadito 500g: $ 2.100 (Costo: $ 1.650) stock 40
- Aceite Natura Girasol 900ml: $ 1.750 (Costo: $ 1.820) stock 25
- Cerveza Quilmes Clásica 1L: $ 1.900 (Costo: $ 1.350) x 12
- Café La Virginia Molido 500g: $ 3.800 (Costo: $ 2.500) stock 15
- Harina 000 Cañuelas 1kg: $ 890 (Costo: $ 810) stock 50
- Fernet Branca 750ml: $ 9.200 (Costo: $ 6.800) stock 8
- Galletitas Chocolinas 250g: $ 1.300 (Costo: $ 920) stock 30
- Detergente Magistral 500ml: $ 1.850 (Costo: $ 1.250) stock 20
- Jabón Líquido Ariel 3L: $ 7.500 (Costo: $ 5.100) stock 10`;

  return res.json({
    sampleWhatsAppText
  });
});

module.exports = router;
