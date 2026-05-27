import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

TEXT_SUFFIXES = {
    ".txt",
    ".log",
    ".csv",
    ".json",
    ".xml",
    ".ini",
    ".conf",
    ".config",
    ".yml",
    ".yaml",
    ".md",
    ".html",
    ".htm",
    ".aspx",
    ".asp",
    ".php",
    ".ps1",
    ".bat",
    ".cmd",
}


@router.get("/list")
def list_files(path: str = Query(default="data/downloads")) -> dict[str, object]:
    directory = _resolve_path(path)
    if not directory.exists():
        directory.mkdir(parents=True, exist_ok=True)
    if not directory.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    entries = []
    for item in sorted(directory.iterdir(), key=lambda entry: (entry.is_file(), entry.name.lower())):
        stat = item.stat()
        entries.append(
            {
                "name": item.name,
                "path": str(item),
                "kind": "directory" if item.is_dir() else "file",
                "size": stat.st_size,
                "child_count": _count_children(item) if item.is_dir() else 0,
                "updated_at": stat.st_mtime,
            }
        )
    return {"path": str(directory), "entries": entries}


@router.get("/read")
def read_file(path: str) -> dict[str, object]:
    file_path = _resolve_path(path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    if file_path.stat().st_size > 200_000:
        raise HTTPException(status_code=413, detail="File is too large to preview")
    if file_path.suffix.lower() not in TEXT_SUFFIXES:
        raise HTTPException(status_code=415, detail="Preview only supports text-like files")
    return {
        "path": str(file_path),
        "content": file_path.read_text(encoding="utf-8", errors="replace"),
    }


@router.delete("/directory")
def delete_directory(path: str) -> dict[str, str]:
    directory = _resolve_path(path)
    if not directory.exists():
        raise HTTPException(status_code=404, detail="Directory not found")
    if not directory.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")
    if directory == directory.parent:
        raise HTTPException(status_code=400, detail="Refusing to delete filesystem root")
    shutil.rmtree(directory)
    return {"deleted": str(directory)}


def _resolve_path(path: str) -> Path:
    candidate = Path(path or "data/downloads").expanduser()
    if not candidate.is_absolute():
        candidate = Path.cwd() / candidate
    return candidate.resolve()


def _count_children(path: Path) -> int:
    try:
        return sum(1 for _ in path.iterdir())
    except OSError:
        return 0
