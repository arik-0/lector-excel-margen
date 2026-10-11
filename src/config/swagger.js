/**
 * Especificación OpenAPI 3.0 para la API de Margen DataBridge
 */
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Margen DataBridge API - Lector & Normalizador de Productos',
    version: '1.0.0',
    description: `
API REST diseñada para **Margen** (gestión financiera y rentabilidad para PyMEs y comercios).
Permite ingerir catálogos y listas desestructuradas desde **Excel**, **CSV** o mensajes de **WhatsApp**, normalizar productos, calcular métricas financieras (Costo Real, Margen Bruto $, % Margen, Markup, Capital Inmovilizado y Alertas a Pérdida) y consumirlos en la aplicación central de Margen.

### Características Clave:
- **Detección inteligente de columnas**: Mapeo difuso de 'Precio Costo', 'PVP', 'Rubro', 'Stock', etc.
- **Soporte multiformato**: Archivos .xlsx, .xls, .csv y texto plano/mensajes de WhatsApp.
- **Motor Financiero Margen**: Cálculo automático de márgenes y detección de ventas a pérdida.
- **Integración instantánea**: Exportación directa a Excel y payloads JSON listos para base de datos.
    `,
    contact: {
      name: 'Equipo de Desarrollo Margen',
      url: 'https://www.linkedin.com/company/tumargen/'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor Local de Desarrollo'
    }
  ],
  paths: {
    '/api/v1/import/excel': {
      post: {
        summary: 'Importar y procesar archivo Excel o CSV',
        description: 'Sube un archivo .xlsx, .xls o .csv. Detecta automáticamente la fila de encabezados, columnas relevantes y calcula métricas de margen.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Archivo Excel o CSV a procesar'
                  },
                  sheetName: {
                    type: 'string',
                    description: 'Nombre de la hoja de cálculo a leer (opcional, por defecto la primera)'
                  },
                  customMapping: {
                    type: 'string',
                    description: 'JSON opcional con mapeo personalizado de columnas ej: {"name":"Descripción","costPrice":"Costo","salePrice":"Precio"}'
                  },
                  minHealthyMargin: {
                    type: 'number',
                    default: 15,
                    description: 'Porcentaje mínimo de margen considerado saludable (default: 15%)'
                  }
                },
                required: ['file']
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Productos procesados exitosamente',
            content: {
              'application/json': {
                example: {
                  success: true,
                  filename: 'lista_precios.xlsx',
                  sheetNames: ['General', 'Bebidas'],
                  selectedSheet: 'General',
                  headers: ['COD', 'ARTICULO', 'COSTO', 'PRECIO VENTA', 'STOCK'],
                  mapping: {
                    sku: 'COD',
                    name: 'ARTICULO',
                    costPrice: 'COSTO',
                    salePrice: 'PRECIO VENTA',
                    stock: 'STOCK'
                  },
                  summary: {
                    totalProducts: 45,
                    totalCapitalInStock: 2500000,
                    averageMarginPercentage: 32.5,
                    lossCount: 2,
                    criticalCount: 5
                  },
                  products: [
                    {
                      id: 'p-1',
                      sku: 'ART-001',
                      name: 'Yerba Mate 500g',
                      category: 'Almacén',
                      costPrice: 1500,
                      salePrice: 2200,
                      grossMargin: 700,
                      marginPercentage: 31.82,
                      markupPercentage: 46.67,
                      stock: 50,
                      stockValueCost: 75000,
                      status: 'HEALTHY',
                      statusLabel: 'Saludable',
                      alerts: []
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/import/whatsapp': {
      post: {
        summary: 'Interpretar texto o mensajes de WhatsApp',
        description: 'Extrae productos, precios, costos y stock desde mensajes pegados directamente desde WhatsApp o listas informales.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    description: 'Texto copiado del chat de WhatsApp con productos y precios'
                  },
                  defaultIsCost: {
                    type: 'boolean',
                    default: false,
                    description: 'Si es true, un precio único sin especificar se interpreta como costo de compra'
                  },
                  defaultMarkupPercent: {
                    type: 'number',
                    default: 30,
                    description: 'Porcentaje de remarcación sugerido si sólo se detecta el costo'
                  },
                  minHealthyMargin: {
                    type: 'number',
                    default: 15
                  }
                },
                required: ['text']
              },
              example: {
                text: "Coca Cola 1.5L: $1.450 (Costo: $980) x 24 un\nYerba Playadito 500g: $2.100 (Costo: $1.650) stock 40\nAceite Girasol 900ml: $1.750 (Costo: $1.850)",
                defaultMarkupPercent: 30
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Texto interpretado correctamente'
          }
        }
      }
    },
    '/api/v1/products/normalize': {
      post: {
        summary: 'Recalcular métricas de una lista de productos',
        description: 'Recibe un array de productos (con modificaciones de precios o costos) y devuelve los márgenes actualizados.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  products: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        costPrice: { type: 'number' },
                        salePrice: { type: 'number' },
                        stock: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Métricas recalculadas'
          }
        }
      }
    },
    '/api/v1/products/format-margen': {
      post: {
        summary: 'Obtener payload en formato estándar de Margen',
        description: 'Genera el JSON final formateado con la estructura requerida por la base de datos o API de Margen.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  products: { type: 'array', items: { type: 'object' } },
                  metadata: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Payload estructurado'
          }
        }
      }
    },
    '/api/v1/sync/margen': {
      post: {
        summary: 'Sincronizar directamente con la App de Margen',
        description: 'Empuja la lista normalizada a la URL de la API de Margen configurada o simula el envío con validación completa.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  products: { type: 'array', items: { type: 'object' } },
                  targetApiUrl: { type: 'string', description: 'URL de la API de Margen (opcional)' },
                  apiKey: { type: 'string', description: 'Bearer Token o API Key de Margen' },
                  organization: { type: 'string', description: 'Nombre de la PyME o cliente' }
                },
                required: ['products']
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Resultado de la sincronización'
          }
        }
      }
    }
  }
};

module.exports = swaggerDocument;
