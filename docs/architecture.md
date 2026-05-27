# Arquitectura inicial

La app empieza como un centro local de hallazgos para auditorias de Active Directory.

## Principios

- El core debe funcionar en Windows y Kali.
- Las integraciones especificas de Kali viven en `importers/` y futuros `collectors/`.
- Primero se importan resultados; despues se ejecutaran herramientas desde la app.
- Cada hallazgo debe conservar evidencia, severidad, estado y origen.

## Flujo previsto

```text
Herramientas / archivos
  -> importers
  -> servicios de normalizacion
  -> findings engine
  -> API
  -> UI operativa
```

## Proximas piezas

- Persistencia con PostgreSQL.
- Modelo de Engagement, Asset, Evidence y ToolRun.
- Importador JSON para BloodHound.
- Importador TXT/CSV para NetExec.
- Exportacion Markdown/HTML para reporte.
