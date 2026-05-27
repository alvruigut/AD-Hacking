import json
from pathlib import Path
from typing import Any


class JsonStore:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or Path("data/workspace.json")

    def read(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}
        return json.loads(self.path.read_text(encoding="utf-8"))

    def write_section(self, section: str, value: Any) -> None:
        data = self.read()
        data[section] = value
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")


json_store = JsonStore()
