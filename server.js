const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./src/config/swagger');

const importRoutes = require('./src/routes/importRoutes');
const productRoutes = require('./src/routes/productRoutes');
const syncRoutes = require('./src/routes/syncRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Servir frontend estático
app.use(express.static(path.join(__dirname, 'public')));

// Documentación interactiva Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Margen DataBridge - Documentación de API'
}));
app.use('/api-docs', (req, res) => res.redirect('/docs'));

// Rutas de API
app.use('/api/v1/import', importRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/sync', syncRoutes);

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Margen DataBridge API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Manejador de errores no capturados
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Margen DataBridge Server iniciado exitosamente!`);
    console.log(`📊 Interfaz Web:        http://localhost:${PORT}`);
    console.log(`📖 Documentación Swagger: http://localhost:${PORT}/docs`);
    console.log(`⚡ API Health Check:    http://localhost:${PORT}/api/v1/health`);
    console.log(`====================================================`);
  });
}

module.exports = app;
