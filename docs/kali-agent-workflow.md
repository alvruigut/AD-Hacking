# Kali agent workflow

Este flujo esta pensado para auditorias autorizadas de Active Directory.

## Fase 1: scope

Define el rango autorizado y, si lo conoces, el dominio:

```text
scope: 10.10.10.0/24
domain: corp.local
```

La API genera un plan con:

- Descubrimiento de red con RustScan.
- Filtro de hosts Windows/SMB con NetExec.
- Confirmacion LDAP para localizar DCs.
- Generacion de entradas para `/etc/hosts`.

## Fase 2: importar resultados

Primero importamos outputs antes de ejecutar desde la UI. Esto permite revisar ruido, errores y falsos positivos.

Endpoints utiles:

```text
POST /api/agent/plan
POST /api/agent/ingest/netexec/smb
GET  /api/assets
GET  /api/findings
GET  /api/agent/hosts-file
```

## Fase 2.5: ejecutar desde el panel

Para lanzar comandos con click, el backend debe estar corriendo en Kali. El navegador puede estar en Kali o en otra maquina, pero la API es quien ejecuta el proceso local.

La ejecucion usa:

```text
POST /api/agent/execute
```

Protecciones iniciales:

- Solo herramientas permitidas: `rustscan`, `netexec`, `nxc`, `nmap`, `ldapsearch`, `smbclient`, `smbmap`.
- El comando debe incluir el scope CIDR autorizado.
- No se usa shell del sistema; el comando se separa en argumentos.
- El output queda registrado como `ToolRun`.
- La salida `netexec smb` se parsea automaticamente para crear activos y hallazgos.

## Fase 3: `/etc/hosts`

La app no debe editar `/etc/hosts` automaticamente sin confirmacion. Genera el bloque:

```text
GET /api/agent/hosts-file
```

En Kali puedes revisarlo y aplicarlo manualmente:

```bash
curl http://localhost:8000/api/agent/hosts-file
```

## Credenciales

No guardar secretos en claro por defecto. Para credenciales encontradas conviene registrar:

- usuario
- dominio
- origen
- tipo: password, hash, ticket, token
- estado: descubierto, validado, revocado
- evidencia asociada

El valor secreto deberia cifrarse o guardarse fuera de la base principal.
