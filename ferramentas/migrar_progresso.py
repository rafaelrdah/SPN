#!/usr/bin/env python3
"""Exporta apenas as marcações de uma conta da versão antiga com SQLite."""
import argparse
import datetime
import json
import sqlite3
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("banco", type=Path, help="Caminho para progress.sqlite3 da versão com servidor")
    parser.add_argument("usuario", help="Usuário que será exportado")
    options = parser.parse_args()
    database = options.banco.resolve()
    if not database.is_file():
        parser.error("Banco não encontrado.")
    catalog_path = Path(__file__).resolve().parent.parent / "episodes.json"
    allowed = {episode["key"] for episode in json.loads(catalog_path.read_text(encoding="utf-8"))}
    with sqlite3.connect(database.as_uri() + "?mode=ro", uri=True) as db:
        account = db.execute("SELECT id, username FROM users WHERE username_norm=?", (options.usuario.lower(),)).fetchone()
        if account is None:
            parser.error("Esse usuário não está no banco antigo.")
        progress = dict(db.execute("SELECT episode_key, status FROM progress WHERE user_id=?", (account[0],)))
    if any(key not in allowed or status not in {"planned", "watched", "skipped"} for key, status in progress.items()):
        parser.error("O banco contém marcações incompatíveis com este catálogo.")
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    output = Path.cwd() / f"Supernatural_{account[1]}_{today}.json"
    payload = {"app": "supernatural-guia-de-episodios", "version": 1, "username": account[1], "savedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "progress": progress}
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exportadas {len(progress)} marcações para {output}")
    print("No site: crie uma conta local, abra Conta → Importar arquivo e confirme a restauração.")


if __name__ == "__main__":
    main()
