import re
import shlex
import shutil
import subprocess
import threading
from datetime import datetime, timezone

from app.schemas.agent import (
    AgentCommand,
    AgentPlan,
    AgentPlanRequest,
    HostsEntry,
    ToolExecuteRequest,
    ToolRunCreate,
    ToolRunRead,
    ToolRunStatus,
)
from app.schemas.asset import AssetCreate, AssetKind, AssetRead
from app.schemas.finding import FindingCreate, Severity
from app.services.asset_service import asset_service
from app.services.finding_service import finding_service


class AgentService:
    def __init__(self) -> None:
        self._tool_runs: dict[str, ToolRunRead] = {}
        self._processes: dict[str, subprocess.Popen[str]] = {}
        self._lock = threading.Lock()
        self._allowed_tools = {
            "rustscan",
            "netexec",
            "nxc",
            "nmap",
            "ldapsearch",
            "smbclient",
            "smbmap",
        }

    def build_plan(self, request: AgentPlanRequest) -> AgentPlan:
        target = request.target_ip if request.target_mode == "ip" and request.target_ip else request.scope_cidr
        domain_arg = f" -d {request.domain}" if request.domain else ""

        if request.target_mode == "cidr":
            commands = [
                AgentCommand(
                    phase="network_discovery",
                    tool="nxc",
                    command=f"nxc smb {target}",
                    purpose="Mapear hosts SMB del rango autorizado y guardar IP, hostname y dominio detectados.",
                    expected_output="Salida SMB de NetExec con hosts Windows/AD detectados.",
                )
            ]
        else:
            commands = [
                AgentCommand(
                    phase="network_discovery",
                    tool="rustscan",
                    command=f"rustscan -a {target} --no-banner -- -sCV",
                    purpose="Enumerar puertos, servicios, versiones y scripts relevantes del target.",
                    expected_output="Salida RustScan/Nmap sintetizada en la entidad seleccionada.",
                ),
                AgentCommand(
                    phase="ad_host_filter",
                    tool="nxc",
                    command=f"nxc smb {target}{domain_arg} --shares",
                    purpose="Enumerar SMB, hostname, dominio y shares del target seleccionado.",
                    expected_output="Salida de hosts SMB con hostname, dominio y signing.",
                ),
                AgentCommand(
                    phase="ldap_probe",
                    tool="nxc",
                    command=f"nxc ldap {target}{domain_arg}",
                    purpose="Comprobar LDAP en la IP seleccionada y extraer contexto de dominio si aplica.",
                    expected_output="Salida LDAP con dominio, hostname y DCs detectados.",
                ),
            ]

        return AgentPlan(
            scope_cidr=request.scope_cidr,
            target_mode=request.target_mode,
            target=target,
            commands=commands,
            safety_notes=[
                "Ejecutar solo contra rangos donde tienes autorizacion explicita.",
                "Guardar outputs en una carpeta de engagement antes de importarlos.",
                "No almacenar credenciales en claro; registra referencia, origen y estado de validacion.",
            ],
        )

    def list_tool_runs(self) -> list[ToolRunRead]:
        return sorted(self._tool_runs.values(), key=lambda run: run.created_at, reverse=True)

    def create_tool_run(self, payload: ToolRunCreate) -> ToolRunRead:
        tool_run = ToolRunRead(**payload.model_dump())
        with self._lock:
            self._tool_runs[tool_run.id] = tool_run
        return tool_run

    def execute(self, payload: ToolExecuteRequest) -> ToolRunRead:
        args = self._validate_command(payload.command, payload.scope_cidr)
        tool_run = self.create_tool_run(
            ToolRunCreate(
                tool=args[0],
                command=payload.command,
                phase=payload.phase,
                status=ToolRunStatus.running,
            )
        )
        worker = threading.Thread(
            target=self._run_command,
            args=(tool_run.id, args, payload.timeout_seconds, payload.auto_ingest),
            daemon=True,
        )
        worker.start()
        return tool_run

    def complete_tool_run(self, tool_run_id: str, raw_output: str) -> ToolRunRead | None:
        tool_run = self._tool_runs.get(tool_run_id)
        if tool_run is None:
            return None
        updated = tool_run.model_copy(
            update={
                "status": ToolRunStatus.completed,
                "raw_output": raw_output,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        with self._lock:
            self._tool_runs[tool_run_id] = updated
        return updated

    def cancel_tool_run(self, tool_run_id: str) -> ToolRunRead | None:
        with self._lock:
            process = self._processes.get(tool_run_id)
            tool_run = self._tool_runs.get(tool_run_id)
        if tool_run is None:
            return None
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        self._update_run(
            tool_run_id,
            status=ToolRunStatus.failed,
            raw_output=tool_run.raw_output,
            exit_code=tool_run.exit_code,
            error="Command cancelled by operator",
        )
        with self._lock:
            return self._tool_runs.get(tool_run_id)

    def delete_tool_run(self, tool_run_id: str) -> bool:
        with self._lock:
            process = self._processes.get(tool_run_id)
        if process is not None and process.poll() is None:
            self.cancel_tool_run(tool_run_id)
        with self._lock:
            self._processes.pop(tool_run_id, None)
            return self._tool_runs.pop(tool_run_id, None) is not None

    def ingest_netexec_smb(self, raw_output: str) -> list[AssetRead]:
        assets: list[AssetRead] = []
        for line in raw_output.splitlines():
            if "SMB" not in line:
                continue
            ip_match = re.search(r"(\d{1,3}(?:\.\d{1,3}){3})", line)
            if ip_match is None:
                continue
            hostname = self._extract_netexec_field(line, "name") or self._extract_netexec_hostname(line)
            domain = self._extract_netexec_field(line, "domain")
            asset = asset_service.upsert(
                AssetCreate(
                    ip_address=ip_match.group(1),
                    hostname=hostname,
                    domain=domain,
                    kind=AssetKind.server,
                    open_ports=[445],
                    services=["smb"],
                    source_tool="netexec",
                    notes=line.strip(),
                )
            )
            assets.append(asset)

        if assets:
            finding_service.create(
                FindingCreate(
                    title="Hosts SMB asociados al dominio detectados",
                    description=f"Se importaron {len(assets)} hosts desde salida de NetExec SMB.",
                    severity=Severity.info,
                    affected_entities=[asset.hostname or asset.ip_address for asset in assets],
                    evidence=["Salida NetExec SMB importada"],
                    source_tool="netexec",
                    recommendation="Revisar signing, shares expuestos y privilegios efectivos por host.",
                )
            )
        return assets

    def build_hosts_entries(self) -> list[HostsEntry]:
        entries: list[HostsEntry] = []
        for asset in asset_service.list():
            names = [name for name in [asset.hostname, asset.domain] if name]
            if asset.hostname and asset.domain and "." not in asset.hostname:
                names.append(f"{asset.hostname}.{asset.domain}")
            if names:
                entries.append(HostsEntry(ip_address=asset.ip_address, names=sorted(set(names))))
        return entries

    def _extract_netexec_field(self, line: str, field_name: str) -> str | None:
        match = re.search(rf"\({field_name}:([^)]+)\)", line, flags=re.IGNORECASE)
        return match.group(1).strip() if match else None

    def _extract_netexec_hostname(self, line: str) -> str | None:
        match = re.search(r"SMB\s+\d{1,3}(?:\.\d{1,3}){3}\s+\d+\s+(\S+)", line)
        if match is None:
            return None
        hostname = match.group(1).strip()
        return None if hostname.startswith("[") else hostname

    def _validate_command(self, command: str, scope_cidr: str) -> list[str]:
        args = shlex.split(command)
        if not args:
            raise ValueError("Command cannot be empty")

        tool_name = args[0].split("/")[-1]
        if tool_name not in self._allowed_tools:
            allowed = ", ".join(sorted(self._allowed_tools))
            raise ValueError(f"Tool not allowed. Allowed tools: {allowed}")

        if scope_cidr not in command:
            raise ValueError("Command must include the authorized scope CIDR before it can run")

        if shutil.which(args[0]) is None:
            raise ValueError(f"Tool is not installed or not available in PATH: {args[0]}")

        return args

    def _run_command(
        self,
        tool_run_id: str,
        args: list[str],
        timeout_seconds: int,
        auto_ingest: bool,
    ) -> None:
        try:
            process = subprocess.Popen(
                args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            with self._lock:
                self._processes[tool_run_id] = process
            stdout, stderr = process.communicate(timeout=timeout_seconds)
            output = "\n".join(part for part in [stdout, stderr] if part)
            tool_name = args[0].split("/")[-1]
            if auto_ingest and tool_name in {"netexec", "nxc"} and len(args) > 1 and args[1] == "smb":
                self.ingest_netexec_smb(output)
            if auto_ingest and tool_name == "rustscan":
                target_ip = self._extract_rustscan_target(args)
                if target_ip:
                    self.ingest_rustscan_nmap(target_ip, output)
            status = ToolRunStatus.completed if process.returncode == 0 else ToolRunStatus.failed
            self._update_run(
                tool_run_id,
                status=status,
                raw_output=output,
                exit_code=process.returncode,
                error=None if process.returncode == 0 else "Command exited with a non-zero code",
            )
        except subprocess.TimeoutExpired as exc:
            with self._lock:
                process = self._processes.get(tool_run_id)
            if process is not None and process.poll() is None:
                process.kill()
            output = "\n".join(part for part in [exc.stdout, exc.stderr] if isinstance(part, str))
            self._update_run(
                tool_run_id,
                status=ToolRunStatus.failed,
                raw_output=output,
                error=f"Command timed out after {timeout_seconds} seconds",
            )
        except Exception as exc:
            self._update_run(tool_run_id, status=ToolRunStatus.failed, error=str(exc))
        finally:
            with self._lock:
                self._processes.pop(tool_run_id, None)

    def ingest_rustscan_nmap(self, target_ip: str, raw_output: str) -> AssetRead | None:
        port_details = self._parse_nmap_services(raw_output)
        if not port_details:
            return None

        services = [
            str(detail["service"])
            for detail in port_details
            if detail.get("service") and detail.get("service") != "unknown"
        ]
        summary_lines = [
            self._summarize_port_detail(detail)
            for detail in port_details
        ]
        asset = asset_service.upsert(
            AssetCreate(
                ip_address=target_ip,
                open_ports=[int(detail["port"]) for detail in port_details],
                services=services,
                port_details=port_details,
                source_tool="rustscan",
                notes="\n".join(summary_lines),
            )
        )
        finding_service.create(
            FindingCreate(
                title=f"Servicios expuestos en {asset.hostname or target_ip}",
                description=f"RustScan/Nmap detecto {len(port_details)} puertos abiertos en {target_ip}.",
                severity=Severity.info,
                affected_entities=[asset.hostname or target_ip],
                evidence=summary_lines,
                source_tool="rustscan",
                recommendation="Revisar servicios AD expuestos, versiones y scripts destacados.",
            )
        )
        return asset

    def _extract_rustscan_target(self, args: list[str]) -> str | None:
        for index, arg in enumerate(args):
            if arg == "-a" and index + 1 < len(args):
                return args[index + 1]
            if arg.startswith("-a") and len(arg) > 2:
                return arg[2:]
        return None

    def _parse_nmap_services(self, raw_output: str) -> list[dict[str, str | int | list[str]]]:
        details: list[dict[str, str | int | list[str]]] = []
        current: dict[str, str | int | list[str]] | None = None
        current_script_is_relevant = False
        relevant_script_prefixes = (
            "dns-",
            "http-",
            "ldap-",
            "smb-",
            "ssl-",
            "krb5-",
            "rdp-",
            "msrpc-",
            "clock-skew",
        )

        for line in raw_output.splitlines():
            stripped = line.strip()
            port_match = re.match(
                r"^(\d+)\/(tcp|udp)\s+open\s+(\S+)(?:\s+(.*))?$",
                stripped,
                flags=re.IGNORECASE,
            )
            if port_match:
                current_script_is_relevant = False
                current = {
                    "port": int(port_match.group(1)),
                    "protocol": port_match.group(2).lower(),
                    "service": port_match.group(3),
                    "version": self._clean_nmap_value(port_match.group(4) or ""),
                    "scripts": [],
                }
                details.append(current)
                continue

            if current is None or not stripped.startswith("|"):
                continue

            script_line = stripped.lstrip("|_ ").strip()
            if not script_line or len(script_line) > 180:
                continue
            is_script_header = ":" in script_line and not script_line.startswith(("|", "_"))
            is_relevant_header = script_line.lower().startswith(relevant_script_prefixes)
            interesting_child = any(
                keyword in script_line.lower()
                for keyword in [
                    "message signing",
                    "domain",
                    "computer name",
                    "netbios",
                    "target_name",
                    "issuer",
                    "subject",
                    "not valid",
                    "clock-skew",
                    "dns",
                    "ldap",
                ]
            )
            if is_script_header:
                current_script_is_relevant = is_relevant_header
            if not is_relevant_header and not (current_script_is_relevant and interesting_child):
                continue
            scripts = current.setdefault("scripts", [])
            if isinstance(scripts, list) and script_line not in scripts:
                scripts.append(script_line)

        return details

    def _clean_nmap_value(self, value: str) -> str:
        return re.sub(r"\s+", " ", value).strip()

    def _summarize_port_detail(self, detail: dict[str, str | int | list[str]]) -> str:
        version = f" - {detail['version']}" if detail.get("version") else ""
        scripts = detail.get("scripts", [])
        script_summary = ""
        if isinstance(scripts, list) and scripts:
            script_summary = f" | {'; '.join(str(script) for script in scripts[:3])}"
        return f"{detail['port']}/{detail.get('protocol', 'tcp')} {detail['service']}{version}{script_summary}"

    def _update_run(
        self,
        tool_run_id: str,
        *,
        status: ToolRunStatus,
        raw_output: str | None = None,
        exit_code: int | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            tool_run = self._tool_runs.get(tool_run_id)
            if tool_run is None:
                return
            self._tool_runs[tool_run_id] = tool_run.model_copy(
                update={
                    "status": status,
                    "raw_output": raw_output,
                    "exit_code": exit_code,
                    "error": error,
                    "updated_at": datetime.now(timezone.utc),
                }
            )


agent_service = AgentService()
