from datetime import datetime, timezone

from app.schemas.finding import FindingCreate, FindingRead, FindingStatus, FindingUpdate, Severity
from app.services.json_store import json_store

SAMPLE_FINDING_TITLES = {
    "Privileged group with broad membership",
    "SMB shares pending review",
}


class FindingService:
    def __init__(self) -> None:
        self._findings: dict[str, FindingRead] = {
            finding.id: finding
            for finding in [
                FindingRead.model_validate(item)
                for item in json_store.read().get("findings", [])
            ]
        }
        if self._remove_sample_findings():
            self._save()

    def list(self) -> list[FindingRead]:
        return sorted(self._findings.values(), key=lambda finding: finding.created_at, reverse=True)

    def create(self, payload: FindingCreate | FindingUpdate) -> FindingRead:
        payload_data = payload.model_dump()
        finding_status = payload_data.pop("status", FindingStatus.new)
        finding = FindingRead(**payload_data, status=finding_status)
        self._findings[finding.id] = finding
        self._save()
        return finding

    def update_status(self, finding_id: str, finding_status: FindingStatus) -> FindingRead | None:
        finding = self._findings.get(finding_id)
        if finding is None:
            return None
        updated = finding.model_copy(
            update={"status": finding_status, "updated_at": datetime.now(timezone.utc)}
        )
        self._findings[finding_id] = updated
        self._save()
        return updated

    def update_severity(self, finding_id: str, severity: Severity) -> FindingRead | None:
        finding = self._findings.get(finding_id)
        if finding is None:
            return None
        updated = finding.model_copy(update={"severity": severity, "updated_at": datetime.now(timezone.utc)})
        self._findings[finding_id] = updated
        self._save()
        return updated

    def update(self, finding_id: str, payload: FindingUpdate) -> FindingRead | None:
        finding = self._findings.get(finding_id)
        if finding is None:
            return None
        updated = finding.model_copy(
            update={
                **payload.model_dump(),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._findings[finding_id] = updated
        self._save()
        return updated

    def delete(self, finding_id: str) -> bool:
        deleted = self._findings.pop(finding_id, None) is not None
        if deleted:
            self._save()
        return deleted

    def _remove_sample_findings(self) -> bool:
        sample_ids = [
            finding_id
            for finding_id, finding in self._findings.items()
            if finding.title in SAMPLE_FINDING_TITLES
        ]
        for finding_id in sample_ids:
            self._findings.pop(finding_id, None)
        return bool(sample_ids)

    def _save(self) -> None:
        json_store.write_section(
            "findings",
            [finding.model_dump(mode="json") for finding in self._findings.values()],
        )


finding_service = FindingService()
