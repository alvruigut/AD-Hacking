from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.schemas.wordlist import WordlistRead


@dataclass(frozen=True)
class WordlistCandidate:
    id: str
    label: str
    category: str
    paths: tuple[str, ...]


WORDLIST_CANDIDATES: tuple[WordlistCandidate, ...] = (
    WordlistCandidate("rockyou", "RockYou", "General", ("/usr/share/wordlists/rockyou.txt",)),
    WordlistCandidate(
        "fuzz-web-dirs",
        "Fuzzing Web Directorios",
        "Fuzzing Web",
        (
            "/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt",
            "/usr/share/wordlists/seclists/Discovery/Web-Content/raft-medium-words.txt",
            "/usr/share/wordlists/SecLists/Discovery/Web-Content/raft-medium-words.txt",
        ),
    ),
    WordlistCandidate(
        "fuzz-web-files",
        "Fuzzing Web Archivos",
        "Fuzzing Web",
        ("/usr/share/wordlists/dirb/common.txt",),
    ),
    WordlistCandidate(
        "fuzz-web-subdomains",
        "Fuzzing Web Subdominios",
        "Fuzzing Web",
        (
            "/usr/share/wordlists/SecLists/Discovery/DNS/subdomains-top1million-5000.txt",
            "/usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-5000.txt",
        ),
    ),
    WordlistCandidate(
        "wordpress-plugins",
        "Plugins Wordpress",
        "Fuzzing Web",
        (
            "/usr/share/wordlists/SecLists/Discovery/Web-Content/CMS/wp-plugins.fuzz.txt",
            "/usr/share/wordlists/seclists/Discovery/Web-Content/CMS/wp-plugins.fuzz.txt",
        ),
    ),
    WordlistCandidate(
        "extensions",
        "Extensiones",
        "Fuzzing Web",
        (
            "/usr/share/wordlists/SecLists/Discovery/Web-Content/raft-small-extensions-lowercase.txt",
            "/usr/share/wordlists/seclists/Discovery/Web-Content/raft-small-extensions-lowercase.txt",
        ),
    ),
    WordlistCandidate(
        "unix-users",
        "Usuarios Unix",
        "Usuarios",
        ("/usr/share/metasploit-framework/data/wordlists/unix_users.txt",),
    ),
    WordlistCandidate(
        "xato-users-top",
        "Usuarios TOP",
        "Usuarios",
        (
            "/usr/share/wordlists/seclists/Usernames/xato-net-10-million-usernames.txt",
            "/usr/share/wordlists/SecLists/Usernames/xato-net-10-million-usernames.txt",
        ),
    ),
    WordlistCandidate(
        "top-users-short",
        "Usuarios Shortlist",
        "Usuarios",
        (
            "/usr/share/wordlists/seclists/Usernames/top-usernames-shortlist.txt",
            "/usr/share/wordlists/SecLists/Usernames/top-usernames-shortlist.txt",
            "/usr/share/wordlist/seclists/usernames/top-usernames-shortlist.txt",
        ),
    ),
    WordlistCandidate(
        "unix-passwords",
        "Passwords Unix",
        "Contrasenas",
        ("/usr/share/metasploit-framework/data/wordlists/unix_passwords.txt",),
    ),
    WordlistCandidate(
        "common-passwords",
        "100 Common Passwords",
        "Contrasenas",
        ("/usr/share/wordlists/100-common-passwords.txt",),
    ),
)


class WordlistService:
    def list(self) -> list[WordlistRead]:
        discovered: list[WordlistRead] = []
        for candidate in WORDLIST_CANDIDATES:
            resolved_path, source = self._resolve(candidate)
            if resolved_path is None:
                continue
            discovered.append(
                WordlistRead(
                    id=candidate.id,
                    label=candidate.label,
                    category=candidate.category,
                    path=str(resolved_path),
                    source=source,
                )
            )
        return discovered

    def _resolve(self, candidate: WordlistCandidate) -> tuple[Path | None, str]:
        for raw_path in candidate.paths:
            path = Path(raw_path)
            if path.is_file():
                return path.resolve(), "path"

        for raw_path in candidate.paths:
            located = self._locate(Path(raw_path).name)
            if located is not None:
                return located, "locate"

        for raw_path in candidate.paths:
            found = self._find(Path(raw_path).name)
            if found is not None:
                return found, "find"

        return None, "missing"

    def _locate(self, filename: str) -> Path | None:
        if shutil.which("locate") is None:
            return None
        result = self._run(["locate", "-b", f"\\{filename}"], timeout=6)
        if not result:
            return None
        return self._first_existing_path(result)

    def _find(self, filename: str) -> Path | None:
        search_roots = [
            "/usr/share/wordlists",
            "/usr/share/metasploit-framework/data/wordlists",
        ]
        existing_roots = [root for root in search_roots if Path(root).is_dir()]
        if not existing_roots or shutil.which("find") is None:
            return None
        result = self._run(["find", *existing_roots, "-iname", filename, "-type", "f"], timeout=12)
        if not result:
            return None
        return self._first_existing_path(result)

    def _run(self, command: list[str], timeout: int) -> str:
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                check=False,
                text=True,
                timeout=timeout,
            )
        except (OSError, subprocess.SubprocessError):
            return ""
        return completed.stdout

    def _first_existing_path(self, output: str) -> Path | None:
        for line in output.splitlines():
            path = Path(line.strip())
            if path.is_file():
                return path.resolve()
        return None


wordlist_service = WordlistService()
