from fastapi import APIRouter, HTTPException, status

from app.schemas.finding import FindingRead, FindingStatus, FindingUpdate, Severity
from app.services.finding_service import finding_service

router = APIRouter()


@router.get("", response_model=list[FindingRead])
def list_findings() -> list[FindingRead]:
    return finding_service.list()


@router.post("", response_model=FindingRead, status_code=status.HTTP_201_CREATED)
def create_finding(payload: FindingUpdate) -> FindingRead:
    return finding_service.create(payload)


@router.patch("/{finding_id}/status", response_model=FindingRead)
def update_status(finding_id: str, finding_status: FindingStatus) -> FindingRead:
    finding = finding_service.update_status(finding_id, finding_status)
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    return finding


@router.patch("/{finding_id}/severity", response_model=FindingRead)
def update_severity(finding_id: str, severity: Severity) -> FindingRead:
    finding = finding_service.update_severity(finding_id, severity)
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    return finding


@router.put("/{finding_id}", response_model=FindingRead)
def update_finding(finding_id: str, payload: FindingUpdate) -> FindingRead:
    finding = finding_service.update(finding_id, payload)
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    return finding


@router.delete("/{finding_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_finding(finding_id: str) -> None:
    deleted = finding_service.delete(finding_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
