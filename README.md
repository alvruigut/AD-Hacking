# AD-Hacking

AD Red Team Notes

Centro local para registrar hallazgos, evidencias y entidades durante auditorias de Active Directory.

## Stack inicial

- Backend: FastAPI + Python
- Frontend: React + TypeScript + Vite
- Datos: PostgreSQL preparado en Docker Compose
- Estilo: interfaz oscura operativa para trabajo red team

## Arranque rapido

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

En Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

API: http://localhost:8000
Docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173

### Docker

```bash
docker compose up --build
```

Frontend: http://localhost:5173
Backend: http://localhost:8000
Postgres: localhost:5432

## Estructura

```text
backend/
  app/
    api/
    core/
    findings/
    importers/
    models/
    schemas/
    services/
    main.py
frontend/
  src/
    api/
    components/
    views/
    styles/
docs/
scripts/
docker-compose.yml
```

## Siguiente paso

La primera persistencia real deberia mover los hallazgos en memoria a PostgreSQL con SQLAlchemy/Alembic.

## Probar el agente Kali

Para ejecutar comandos con click, arranca el backend en Kali. La UI llama a la API y la API ejecuta herramientas locales como `rustscan` o `netexec`.

Con el backend arrancado, genera un plan:

```powershell
Invoke-RestMethod http://localhost:8000/api/agent/plan `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"scope_cidr":"10.10.10.0/24","domain":"corp.local","rate_profile":"balanced"}'
```

Importa una salida de NetExec SMB:

```powershell
Invoke-RestMethod http://localhost:8000/api/agent/ingest/netexec/smb `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"raw_output":"SMB 10.10.10.10 445 DC01 [*] Windows Server (name:DC01) (domain:corp.local)"}'
```

Consulta activos y bloque `/etc/hosts`:

```powershell
Invoke-RestMethod http://localhost:8000/api/assets
Invoke-RestMethod http://localhost:8000/api/agent/hosts-file
```

Desde el panel web:

1. Abre `http://localhost:5173`.
2. Genera un plan con tu scope autorizado.
3. Edita el comando antes de lanzarlo.
4. Pulsa `Ejecutar`.
5. Revisa `Output desde Kali`, `Equipos detectados` y `Hallazgos`.
