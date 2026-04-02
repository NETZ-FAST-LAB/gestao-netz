"""
Migration Module to handle transferring tasks from projetos.json to PostgreSQL
"""
import json
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from Bot.config import settings

async def init_db():
    if not settings.database_url:
        print("DATABASE_URL is missing! Migration aborting.")
        return
        
    engine = create_async_engine(settings.database_url)
    
    async with engine.begin() as conn:
        # Create Tables
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS projects (
                id VARCHAR(255) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                client VARCHAR(255),
                owner VARCHAR(255),
                column_status VARCHAR(100),
                tags JSONB,
                meta JSONB
            );
        """))
        
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tasks (
                id VARCHAR(255) PRIMARY KEY,
                project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                assignee VARCHAR(255),
                status VARCHAR(50),
                due_date VARCHAR(50),
                meta JSONB
            );
        """))
        print("Tables created successfully.")
    
    return engine

async def migrate_json_to_pg():
    try:
        with open("Operacional/Kanban/projetos.json", "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print("projetos.json not found locally.")
        return

    engine = await init_db()
    if not engine: return
    
    Session = async_sessionmaker(engine)
    
    async with Session() as session:
        for board in data.get("boards", []):
            for card in board.get("cards", []):
                # Upsert Project
                await session.execute(
                    text("""
                    INSERT INTO projects (id, title, client, owner, column_status, tags, meta) 
                    VALUES (:id, :title, :client, :owner, :col, :tags, :meta)
                    ON CONFLICT (id) DO NOTHING
                    """),
                    {
                        "id": card.get("id"), "title": card.get("title", ""), "client": card.get("client", ""), 
                        "owner": card.get("owner", ""), "col": card.get("column", ""), 
                        "tags": json.dumps(card.get("tags", [])), 
                        "meta": json.dumps({"health": card.get("health_status", ""), "marcos": card.get("marcos_alinhamento", [])})
                    }
                )
                
                # Upsert Tasks
                for task in card.get("tasks", []):
                    await session.execute(
                        text("""
                        INSERT INTO tasks (id, project_id, title, assignee, status, due_date)
                        VALUES (:id, :pid, :title, :assignee, :status, :date)
                        ON CONFLICT (id) DO NOTHING
                        """),
                        {
                            "id": task.get("id"), "pid": card.get("id"), "title": task.get("title"),
                            "assignee": task.get("assignee", ""), "status": task.get("status", ""), "date": task.get("dueDate", "")
                        }
                    )
        await session.commit()
        print("Migration JSON -> Postgres successful.")

if __name__ == "__main__":
    asyncio.run(migrate_json_to_pg())
