from datetime import datetime, timezone

from app.schemas.finding import FindingCreate, FindingRead, FindingStatus, Severity


class FindingService:
    def __init__(self) -> None:
        self._findings: dict[str, FindingRead] = {}
        self._seed()

    def list(self) -> list[FindingRead]:
        return sorted(self._findings.values(), key=lambda finding: finding.created_at, reverse=True)

    def create(self, payload: FindingCreate) -> FindingRead:
        finding = FindingRead(**payload.model_dump())
        self._findings[finding.id] = finding
        return finding

    def update_status(self, finding_id: str, finding_status: FindingStatus) -> FindingRead | None:
        finding = self._findings.get(finding_id)
        if finding is None:
            return None
        updated = finding.model_copy(
            update={"status": finding_status, "updated_at": datetime.now(timezone.utc)}
        )
        self._findings[finding_id] = updated
        return updated

    def update_severity(self, finding_id: str, severity: Severity) -> FindingRead | None:
        finding = self._findings.get(finding_id)
        if finding is None:
            return None
        updated = finding.model_copy(update={"severity": severity, "updated_at": datetime.now(timezone.utc)})
        self._findings[finding_id] = updated
        return updated

    def _seed(self) -> None:
        samples = [
            FindingCreate(
                title="Privileged group with broad membership",
                description="Domain Admins contains accounts that should be reviewed before testing.",
                severity=Severity.high,
                affected_entities=["Domain Admins", "alvaro.admin"],
                evidence=["Imported seed finding"],
                source_tool="manual",
                recommendation="Confirm business ownership and remove stale privileged members.",
            ),
            FindingCreate(
                title="SMB shares pending review",
                description="Initial engagement has shares queued for permission analysis.",
                severity=Severity.medium,
                affected_entities=["FILE01"],
                evidence=["Awaiting collector output"],
                source_tool="manual",
                recommendation="Import NetExec or smbmap output and classify exposed paths.",
            ),
        ]
        for sample in samples:
            self.create(sample)


finding_service = FindingService()
