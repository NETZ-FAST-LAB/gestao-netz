"""
Force-repopulate tasks from JSON files into PostgreSQL.
Uses ON CONFLICT DO UPDATE to overwrite stale data.
Run this once from the EasyPanel shell: python db_repopulate.py
"""
import json
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from config import settings


async def repopulate():
    if not settings.database_url:
        print("DATABASE_URL is missing! Aborting.")
        return

    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine)

    files_to_process = [
        "Operacional/Kanban/projetos.json",
        "Operacional/Kanban/iniciativas.json",
    ]

    projects_count = 0
    tasks_count = 0

    async with Session() as session:
        for file_path in files_to_process:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except FileNotFoundError:
                print(f"  [SKIP] {file_path} not found.")
                continue

            print(f"  [Processing] {file_path}")
            for board in data.get("boards", []):
                for card in board.get("cards", []):
                    card_id = card.get("id")
                    if not card_id:
                        continue

                    # Upsert project/initiative
                    await session.execute(
                        text("""
                        INSERT INTO projects (id, title, client, owner, column_status, tags, meta)
                        VALUES (:id, :title, :client, :owner, :col, :tags, :meta)
                        ON CONFLICT (id) DO UPDATE SET
                            title = EXCLUDED.title,
                            client = EXCLUDED.client,
                            owner = EXCLUDED.owner,
                            column_status = EXCLUDED.column_status,
                            tags = EXCLUDED.tags,
                            meta = EXCLUDED.meta
                        """),
                        {
                            "id": card_id,
                            "title": card.get("title", ""),
                            "client": card.get("client", ""),
                            "owner": card.get("owner", ""),
                            "col": card.get("column", "Backlog"),
                            "tags": json.dumps(card.get("tags", [])),
                            "meta": json.dumps({
                                "health": card.get("health_status", ""),
                                "marcos": card.get("marcos_alinhamento", []),
                                "lembretes": card.get("lembretes_mintzie", {}),
                            }),
                        }
                    )
                    projects_count += 1

                    # Upsert tasks
                    for task in card.get("tasks", []):
                        task_id = task.get("id")
                        if not task_id:
                            continue

                        assignee = task.get("assignee") or task.get("responsável") or ""
                        raw_status = task.get("status", "pending")

                        await session.execute(
                            text("""
                            INSERT INTO tasks (id, project_id, title, assignee, status, due_date)
                            VALUES (:id, :pid, :title, :assignee, :status, :date)
                            ON CONFLICT (id) DO UPDATE SET
                                title = EXCLUDED.title,
                                assignee = EXCLUDED.assignee,
                                status = EXCLUDED.status,
                                due_date = EXCLUDED.due_date
                            """),
                            {
                                "id": task_id,
                                "pid": card_id,
                                "title": task.get("title", ""),
                                "assignee": assignee,
                                "status": raw_status,
                                "date": task.get("dueDate", ""),
                            }
                        )
                        tasks_count += 1

        await session.commit()

    print(f"\n✅ Done! {projects_count} projects/initiatives and {tasks_count} tasks upserted.")


if __name__ == "__main__":
    asyncio.run(repopulate())
