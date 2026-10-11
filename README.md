# Margen DataBridge 📊
### Lector Inteligente de Excel & WhatsApp + API de Rentabilidad para PyMEs

Solución desarrollada a medida para el ecosistema de **[Margen](https://www.linkedin.com/company/tumargen/)**:

> *"Vender más no siempre es ganar más. La facturación no te dice si te estás quedando con plata... tenés que saber cuánto te sale de verdad cada cosa que vendés, qué te deja plata y qué te la está sacando, cuánto tenés inmovilizado y cómo te pega cada aumento de costos."*

Esta aplicación y su **API REST consumible** resuelven el principal cuello de botella operativo al incorporar clientes a Margen: **ingerir catálogos y listas desestructuradas** (planillas de Excel de proveedores, exports de ERPs con encabezados arbitrarios o listas informales enviadas por WhatsApp), normalizarlos y calcular de inmediato los costos reales y márgenes de rentabilidad.

---

## 🚀 Inicio Rápido

### Requisitos
- **Node.js** v18+ (probado y optimizado en Node.js v24).

### 1. Iniciar la Aplicación
```bash
npm start
```

El servidor quedará disponible en:
- 🖥️ **Tablero Web & Auditoría:** [http://localhost:3000](http://localhost:3000)
- 📖 **Documentación Swagger / OpenAPI:** [http://localhost:3000/docs](http://localhost:3000/docs)
- ⚡ **Health Check de la API:** [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)

---

## 🌟 Funcionalidades Principales

### 1. 📁 Lector Inteligente de Excel / CSV
- **Detección automática de fila de encabezados:** Salta filas vacías o títulos decorativos de distribuidores (`findHeaderRow`).
- **Mapeo difuso de columnas (Fuzzy Mapping):** Detecta automáticamente nombres como `Costo Compra`, `PC`, `Precio Venta`, `PVP`, `Articulo`, `Rubro`, `Stock`.
- **Previsualización interactiva:** Permite revisar y modificar qué columna corresponde a cada campo antes de procesar.
- **Normalización de formatos numéricos:** Convierte montos con signos pesos, comas o puntos de miles típicos de Argentina y Latinoamérica (ej: `$ 1.450,00` o `$ 2.100`).

### 2. 💬 Ingesta Rápida desde WhatsApp & Texto Plano
- **Extracción inteligente de chats y listas:** Pega mensajes directos de WhatsApp de distribuidores o vendedores.
- **Detección multivariable:** Separa nombre del artículo, costo de compra, precio de venta y unidades/stock (`x 24 un`, `stock: 15`).
- **Sugerencia de markup:** Si un proveedor sólo informa el costo, calcula automáticamente el precio de venta sugerido según el markup deseado.

### 3. 📈 Motor Financiero & Auditoría de Márgenes
- **Cálculo de Margen Bruto ($):** `Precio Venta - Costo Unitario`
- **% Margen sobre Venta:** `((Precio Venta - Costo) / Precio Venta) * 100`
- **% Remarcación (Markup):** `((Precio Venta - Costo) / Costo) * 100`
- **Capital Inmovilizado en Stock ($):** `Costo * Stock`
- **Facturación Potencial ($):** `Precio * Stock`
- **🚨 Alertas Automáticas:**
  - `LOSS` (A Pérdida): Artículos donde el costo de compra supera el precio de venta.
  - `CRITICAL` (Margen Crítico): Artículos con margen menor al umbral (ej. < 15%), vulnerables a la inflación.
  - `HEALTHY` & `EXCELLENT`: Artículos con margen óptimo y alto rendimiento.

### 4. 📝 Tabla Interactiva con Recálculo en Vivo
- Permite editar cualquier celda de costo o precio directamente en pantalla.
- Las alertas y márgenes se recalculan al instante.
- Filtros por estado (*A Pérdida*, *Críticos*, *Saludables*) y buscador en tiempo real.

---

## 🔌 API REST Consumible para Integrar en la App de Margen

La API está completamente documentada bajo el estándar **OpenAPI 3.0** en `http://localhost:3000/docs`.

### Endpoints Disponibles:

#### 1. Importar Excel / CSV
- **Método:** `POST /api/v1/import/excel`
- **Tipo:** `multipart/form-data`
- **Parámetros:**
  - `file`: Archivo binario (.xlsx, .xls, .csv).
  - `minHealthyMargin` (opcional, default `15`): Umbral de margen mínimo saludable.
  - `sheetName` (opcional): Nombre de la pestaña a procesar.
  - `customMapping` (opcional): JSON con asociaciones de columnas.

#### 2. Importar Texto / WhatsApp
- **Método:** `POST /api/v1/import/whatsapp`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "text": "Coca Cola 1.5L x 24 un: $ 1.450 (Costo: $ 980)\nYerba Playadito 500g: $ 2.100 (Costo: $ 1.650) stock 40\nAceite Natura 900ml: $ 1.750 (Costo: $ 1.820)",
  "defaultMarkupPercent": 30,
  "minHealthyMargin": 15
}
```

#### 3. Normalizar & Recalcular Márgenes
- **Método:** `POST /api/v1/products/normalize`
- **Headers:** `Content-Type: application/json`
- **Body:** Array de productos para calcular métricas.

#### 4. Obtener Formato Estandarizado para Margen App
- **Método:** `POST /api/v1/products/format-margen`
- Devuelve la estructura unificada lista para insertar en la base de datos de Margen:
```json
{
  "organization": "Mi PyME",
  "importedAt": "2026-10-11T22:15:23.000Z",
  "sourceType": "INTEGRATION_API",
  "products": [
    {
      "externalId": "WPP-001",
      "sku": "BEB-01",
      "name": "Coca Cola 1.5L",
      "category": "Bebidas",
      "pricing": {
        "costUnit": 980,
        "priceUnit": 1450,
        "currency": "ARS",
        "grossMargin": 470,
        "marginPct": 32.41,
        "markupPct": 47.96
      },
      "inventory": {
        "stockUnits": 60,
        "capitalLocked": 58800,
        "potentialRevenue": 87000
      },
      "health": {
        "status": "HEALTHY",
        "label": "Saludable",
        "alerts": []
      }
    }
  ]
}
```

#### 5. Sincronizar Directamente con Margen App
- **Método:** `POST /api/v1/sync/margen`
- Envía el lote de productos al backend de Margen (`targetApiUrl`) con tu `apiKey`. Si no se especifica una URL remota, corre en **Modo Sandbox** validando la carga útil.

#### 6. Exportar Excel Limpio
- **Método:** `POST /api/v1/products/export-excel`
- Genera y descarga un archivo `.xlsx` ordenado con los márgenes y estados de salud calculados.

---

## 💻 Ejemplos de Consumo desde Código

### JavaScript / Node.js
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('minHealthyMargin', 15);

const res = await fetch('http://localhost:3000/api/v1/import/excel', {
  method: 'POST',
  body: formData
});

const { products, summary } = await res.json();
console.log('Productos a pérdida detectados:', summary.lossCount);
```

### Python
```python
import requests

url = "http://localhost:3000/api/v1/import/excel"
with open("lista_distribuidora.xlsx", "rb") as f:
    resp = requests.post(url, files={"file": f}, data={"minHealthyMargin": 15})
    data = resp.json()
    print(f"Margen promedio: {data['summary']['averageMarginPercentage']}%")
```

---

## 🧪 Pruebas Automatizadas

Para correr los tests de parseo y cálculo financiero:
```bash
npm test
```
