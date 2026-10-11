const app = require('../server');

async function runApiTests() {
  console.log('🚀 Iniciando pruebas de endpoints HTTP de la API...');
  
  const server = app.listen(3001, async () => {
    try {
      // 1. Health check
      console.log('Probando GET /api/v1/health...');
      const healthRes = await fetch('http://localhost:3001/api/v1/health');
      const healthData = await healthRes.json();
      console.log('Health Response:', healthData);
      if (healthData.status !== 'ONLINE') throw new Error('Health check falló');

      // 2. WhatsApp import
      console.log('\nProbando POST /api/v1/import/whatsapp...');
      const wppRes = await fetch('http://localhost:3001/api/v1/import/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: "Fernet Branca 750ml: $ 9200 (Costo: $ 6800) stock 12\nHarina Cañuelas 1kg: $ 890 (Costo: $ 810) stock 80"
        })
      });
      const wppData = await wppRes.json();
      console.log(`WhatsApp import devolvió ${wppData.products.length} productos. Resumen de margen:`, wppData.summary);
      if (wppData.products.length !== 2) throw new Error('WhatsApp import falló');

      // 3. Formato para Margen App
      console.log('\nProbando POST /api/v1/products/format-margen...');
      const formatRes = await fetch('http://localhost:3001/api/v1/products/format-margen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: wppData.products,
          metadata: { organization: 'Almacén Don Tito' }
        })
      });
      const formatData = await formatRes.json();
      console.log('Payload formateado para Margen:', JSON.stringify(formatData.data.products[0], null, 2));

      // 4. Sincronización (Modo Sandbox)
      console.log('\nProbando POST /api/v1/sync/margen...');
      const syncRes = await fetch('http://localhost:3001/api/v1/sync/margen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: wppData.products,
          organization: 'Almacén Don Tito'
        })
      });
      const syncData = await syncRes.json();
      console.log('Resultado Sync Sandbox:', syncData.message);
      if (!syncData.success) throw new Error('Sync sandbox falló');

      console.log('\n🎉 ¡TODOS LOS ENDPOINTS DE LA API FUNCIONAN AL 100%!');
      server.close();
    } catch (err) {
      console.error('❌ Error en test HTTP:', err);
      server.close();
    }
  });
}

runApiTests();
