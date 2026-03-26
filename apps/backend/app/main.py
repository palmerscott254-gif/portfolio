from __future__ import annotations

import asyncio
import hashlib
import json
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import faiss
import httpx
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import JSON, Column, DateTime, Integer, MetaData, String, Table, func, insert, select
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

load_dotenv()

app = FastAPI(title="Newton Digital OS API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data"
PROJECTS_PATH = DATA_DIR / "projects.seed.json"
LEDGER_PATH = DATA_DIR / "work-ledger.jsonl"
ARCHIVE_PATH = DATA_DIR / "archive-state.json"
RAG_DIR = DATA_DIR / "rag"

DATABASE_URL = os.getenv("DATABASE_URL", "")
engine: AsyncEngine | None = create_async_engine(DATABASE_URL, echo=False) if DATABASE_URL else None
metadata = MetaData()
analytics_table = Table(
    "analytics_events",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("event", String(120), nullable=False),
    Column("payload", JSON, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

class AnalyticsEvent(BaseModel):
    event: str
    payload: dict[str, Any] = {}


class AskPayload(BaseModel):
    query: str


class PulseState:
    def __init__(self) -> None:
        self.visitor_count = 1
        self.neural_activity = random.randint(62, 94)
        self.archive_sync_status = "ACTIVE"


pulse_state = PulseState()
clients: set[WebSocket] = set()
last_ledger_hash = "GENESIS"


class RagIndex:
    def __init__(self) -> None:
        self.dim = 256
        self.index = faiss.IndexFlatIP(self.dim)
        self.doc_vectors: list[np.ndarray] = []
        self.docs: list[dict[str, str]] = []

    def _to_vector(self, text: str) -> np.ndarray:
        vector = np.zeros(self.dim, dtype=np.float32)
        for token in text.lower().split():
            digest = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            vector[digest % self.dim] += 1.0
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
        return vector

    def rebuild(self, docs: list[dict[str, str]]) -> None:
        self.docs = docs
        self.index.reset()
        self.doc_vectors.clear()
        if not docs:
            return
        vectors = [self._to_vector(d["text"]) for d in docs]
        matrix = np.stack(vectors)
        self.index.add(matrix)
        self.doc_vectors = vectors

    def query(self, text: str, limit: int = 3) -> list[dict[str, str]]:
        if not self.docs:
            return []
        query_vector = self._to_vector(text).reshape(1, -1)
        _, indices = self.index.search(query_vector, min(limit, len(self.docs)))
        hits = []
        for i in indices[0]:
            if i < 0:
                continue
            hits.append(self.docs[int(i)])
        return hits


rag_index = RagIndex()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return rows


def append_ledger(project_name: str, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    global last_ledger_hash
    entry = {
        "project_name": project_name,
        "eventType": event_type,
        "timestamp": now_iso(),
        "previous_hash": last_ledger_hash,
        "payload": payload,
    }
    digest = hashlib.sha256(json.dumps(entry, sort_keys=True).encode("utf-8")).hexdigest()
    entry["hash"] = digest
    LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER_PATH.open("a", encoding="utf-8") as file:
        file.write(json.dumps(entry) + "\n")
    last_ledger_hash = digest
    return entry


async def db_init() -> None:
    if engine is None:
        return
    try:
        async with engine.begin() as conn:
            await conn.run_sync(metadata.create_all)
    except Exception:
        pass


def load_ledger_state() -> None:
    global last_ledger_hash
    rows = read_jsonl(LEDGER_PATH)
    if rows:
        last_ledger_hash = rows[-1].get("hash") or rows[-1].get("previous_hash") or "GENESIS"


def monitor_urls() -> dict[str, str]:
    return {
        "pie": os.getenv("MONITOR_PIE_GLOBAL_FURNITURES_URL", ""),
        "cpa": os.getenv("MONITOR_CPA_ACADEMY_URL", ""),
        "scholsey": os.getenv("MONITOR_SCHOLSEY_SECURITY_APP_URL", ""),
        "portfolio": os.getenv("MONITOR_PORTFOLIO_URL", "http://localhost:3001"),
    }


async def compute_monitor_status() -> dict[str, str]:
    status: dict[str, str] = {}
    urls = monitor_urls()
    async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
        for key, url in urls.items():
            if not url:
                status[key] = "not-configured"
                continue
            try:
                response = await client.get(url)
                if response.status_code < 400:
                    status[key] = "online"
                elif response.status_code < 500:
                    status[key] = "degraded"
                else:
                    status[key] = "offline"
            except Exception:
                status[key] = "offline"
    return status


def build_rag_docs() -> list[dict[str, str]]:
    projects = read_json(PROJECTS_PATH, [])
    docs: list[dict[str, str]] = [
        {
            "id": "projects.seed.json",
            "text": " ".join(
                f"{p.get('name')}. {p.get('desc')}. Impact: {p.get('impact')}. Tags: {', '.join(p.get('tags', []))}."
                for p in projects
            ),
        }
    ]

    if RAG_DIR.exists():
        for file in RAG_DIR.iterdir():
            if file.suffix.lower() not in {".md", ".txt", ".json"}:
                continue
            docs.append({"id": file.name, "text": file.read_text(encoding="utf-8")})

    return docs


def answer_from_context(query: str, docs: list[dict[str, str]]) -> str:
    fragments = []
    for doc in docs:
        chunks = [segment.strip() for segment in doc["text"].split("\n") if segment.strip()]
        fragments.extend(chunks[:4])

    if not fragments:
        return "I do not have enough indexed context yet."

    query_terms = [q for q in query.lower().split() if len(q) > 2]
    ranked = sorted(
        fragments,
        key=lambda fragment: sum(1 for term in query_terms if term in fragment.lower()),
        reverse=True,
    )
    selected = ranked[:3]
    synthesis = " ".join(selected)
    return (
        "Newton: "
        f"{synthesis} "
        "I design resilient systems with measurable performance, reliability, and clear operational traces."
    )


async def broadcast_pulse() -> None:
    while True:
        pulse_state.neural_activity = max(40, min(99, pulse_state.neural_activity + random.randint(-5, 5)))
        now = datetime.now()
        payload = {
            "server_date": now.strftime("%Y-%m-%d"),
            "server_time": now.strftime("%H:%M:%S"),
            "visitor_count": pulse_state.visitor_count,
            "neural_activity": pulse_state.neural_activity,
            "archive_sync_status": pulse_state.archive_sync_status,
        }
        stale: list[WebSocket] = []
        for client in clients:
            try:
                await client.send_json(payload)
            except Exception:
                stale.append(client)
        for client in stale:
            clients.discard(client)
        await asyncio.sleep(1.0)


@app.on_event("startup")
async def on_startup() -> None:
    await db_init()
    load_ledger_state()
    rag_index.rebuild(build_rag_docs())
    asyncio.create_task(broadcast_pulse())


@app.get("/api/projects")
async def get_projects() -> dict[str, Any]:
    projects = read_json(PROJECTS_PATH, [])
    return {"projects": projects}


@app.get("/api/archive/state")
async def archive_state() -> dict[str, Any]:
    state = read_json(ARCHIVE_PATH, {})
    ledger_rows = read_jsonl(LEDGER_PATH)
    state["stats"] = {
        "total_commits": len(ledger_rows),
        "activity_events": len([r for r in ledger_rows if r.get("eventType") == "analytics_event"]),
    }
    return state


@app.post("/api/archive/sync")
async def archive_sync() -> dict[str, Any]:
    pulse_state.archive_sync_status = "SYNCING"
    state = read_json(ARCHIVE_PATH, {})
    state["lastSyncAt"] = now_iso()
    state["source"] = "seed"
    state["yearsExperience"] = max(1, datetime.now().year - int(os.getenv("CAREER_START_YEAR", "2016")))
    ARCHIVE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")
    append_ledger("portfolio", "archive_sync", {"source": state["source"]})
    pulse_state.archive_sync_status = "ACTIVE"
    return {"status": "ok", "archive_sync_status": pulse_state.archive_sync_status, "state": state}


@app.get("/api/ledger")
async def get_ledger() -> dict[str, Any]:
    rows = read_jsonl(LEDGER_PATH)
    return {"entries": rows[-50:]}


@app.get("/api/monitor/status")
async def monitor_status() -> dict[str, str]:
    status = await compute_monitor_status()
    append_ledger("portfolio", "monitor_status", status)
    return status


@app.post("/api/analytics/track")
async def analytics_track(payload: AnalyticsEvent) -> dict[str, str]:
    event = payload.model_dump()
    created = datetime.now(timezone.utc)
    if engine is not None:
        try:
            async with engine.begin() as conn:
                await conn.execute(
                    insert(analytics_table).values(
                        event=event["event"],
                        payload=event["payload"],
                        created_at=created,
                    )
                )
        except Exception:
            pass

    append_ledger("portfolio", "analytics_event", event)
    return {"status": "tracked"}


@app.get("/api/analytics/summary")
async def analytics_summary() -> dict[str, Any]:
    db_total = 0
    if engine is not None:
        try:
            async with engine.connect() as conn:
                rows = await conn.execute(select(func.count()).select_from(analytics_table))
                db_total = int(rows.scalar_one() or 0)
        except Exception:
            db_total = 0

    ledger_events = len([r for r in read_jsonl(LEDGER_PATH) if r.get("eventType") == "analytics_event"])
    return {"total_events": max(db_total, ledger_events)}


@app.post("/api/ai/ask")
async def ai_ask(payload: AskPayload) -> dict[str, Any]:
    hits = rag_index.query(payload.query, limit=3)
    answer = answer_from_context(payload.query, hits)
    append_ledger("portfolio", "ai_query", {"query": payload.query})
    return {"answer": answer, "sources": [h["id"] for h in hits]}


@app.websocket("/ws/pulse")
async def pulse_socket(socket: WebSocket) -> None:
    await socket.accept()
    clients.add(socket)
    pulse_state.visitor_count += 1
    append_ledger("portfolio", "visitor_connected", {"clients": len(clients)})
    try:
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        clients.discard(socket)
