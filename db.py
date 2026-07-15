import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

DB_PATH = os.environ.get("DB_PATH", "./lecturelens.db")


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS lectures (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                duration_seconds REAL,
                source_filename TEXT
            );

            CREATE TABLE IF NOT EXISTS nodes (
                pk INTEGER PRIMARY KEY AUTOINCREMENT,
                lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
                node_id TEXT NOT NULL,
                type TEXT NOT NULL,
                label TEXT NOT NULL,
                summary TEXT NOT NULL,
                color_theme TEXT,
                hierarchy_level INTEGER,
                bookmarked INTEGER NOT NULL DEFAULT 0,
                notes TEXT,
                UNIQUE(lecture_id, node_id)
            );

            CREATE TABLE IF NOT EXISTS edges (
                pk INTEGER PRIMARY KEY AUTOINCREMENT,
                lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
                edge_id TEXT NOT NULL,
                source TEXT NOT NULL,
                target TEXT NOT NULL,
                label TEXT,
                UNIQUE(lecture_id, edge_id)
            );

            CREATE INDEX IF NOT EXISTS idx_nodes_lecture ON nodes(lecture_id);
            CREATE INDEX IF NOT EXISTS idx_edges_lecture ON edges(lecture_id);
            """
        )
        # Lightweight migration for DBs created before study questions existed.
        try:
            conn.execute("ALTER TABLE lectures ADD COLUMN study_questions TEXT")
        except sqlite3.OperationalError:
            pass  # column already exists


def create_lecture(mind_map, duration_seconds=None, source_filename=None):
    lecture_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    with _connect() as conn:
        conn.execute(
            "INSERT INTO lectures (id, title, created_at, duration_seconds, source_filename) VALUES (?, ?, ?, ?, ?)",
            (lecture_id, mind_map.lecture_title, created_at, duration_seconds, source_filename),
        )
        conn.executemany(
            """INSERT INTO nodes (lecture_id, node_id, type, label, summary, color_theme, hierarchy_level)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [
                (lecture_id, n.id, n.type, n.label, n.summary, n.color_theme, n.hierarchy_level)
                for n in mind_map.nodes
            ],
        )
        conn.executemany(
            "INSERT INTO edges (lecture_id, edge_id, source, target, label) VALUES (?, ?, ?, ?, ?)",
            [(lecture_id, e.id, e.source, e.target, e.label) for e in mind_map.edges],
        )

    return lecture_id


def _row_node(row):
    return {
        "id": row["node_id"],
        "type": row["type"],
        "label": row["label"],
        "summary": row["summary"],
        "color_theme": row["color_theme"],
        "hierarchy_level": row["hierarchy_level"],
        "bookmarked": bool(row["bookmarked"]),
        "notes": row["notes"],
    }


def _row_edge(row):
    return {"id": row["edge_id"], "source": row["source"], "target": row["target"], "label": row["label"]}


def list_lectures():
    with _connect() as conn:
        rows = conn.execute(
            """SELECT l.id, l.title, l.created_at, l.duration_seconds,
                      (SELECT COUNT(*) FROM nodes n WHERE n.lecture_id = l.id) AS node_count
               FROM lectures l ORDER BY l.created_at DESC"""
        ).fetchall()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "created_at": r["created_at"],
            "duration_seconds": r["duration_seconds"],
            "node_count": r["node_count"],
        }
        for r in rows
    ]


def get_lecture(lecture_id):
    with _connect() as conn:
        lecture = conn.execute("SELECT * FROM lectures WHERE id = ?", (lecture_id,)).fetchone()
        if lecture is None:
            return None
        nodes = conn.execute(
            "SELECT * FROM nodes WHERE lecture_id = ? ORDER BY pk", (lecture_id,)
        ).fetchall()
        edges = conn.execute(
            "SELECT * FROM edges WHERE lecture_id = ? ORDER BY pk", (lecture_id,)
        ).fetchall()

    return {
        "id": lecture["id"],
        "lecture_title": lecture["title"],
        "created_at": lecture["created_at"],
        "duration_seconds": lecture["duration_seconds"],
        "nodes": [_row_node(n) for n in nodes],
        "edges": [_row_edge(e) for e in edges],
    }


def get_cached_study_questions(lecture_id):
    """None means "not generated yet" (distinct from a lecture generating zero questions)."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT study_questions FROM lectures WHERE id = ?", (lecture_id,)
        ).fetchone()
    if row is None or row["study_questions"] is None:
        return None
    return json.loads(row["study_questions"])


def save_study_questions(lecture_id, questions):
    with _connect() as conn:
        conn.execute(
            "UPDATE lectures SET study_questions = ? WHERE id = ?",
            (json.dumps(questions), lecture_id),
        )


def delete_lecture(lecture_id):
    with _connect() as conn:
        cur = conn.execute("DELETE FROM lectures WHERE id = ?", (lecture_id,))
        return cur.rowcount > 0


def update_node(lecture_id, node_id, bookmarked=None, notes=None):
    fields = []
    values = []
    if bookmarked is not None:
        fields.append("bookmarked = ?")
        values.append(1 if bookmarked else 0)
    if notes is not None:
        fields.append("notes = ?")
        values.append(notes)

    if not fields:
        with _connect() as conn:
            row = conn.execute(
                "SELECT * FROM nodes WHERE lecture_id = ? AND node_id = ?", (lecture_id, node_id)
            ).fetchone()
        return _row_node(row) if row else None

    values.extend([lecture_id, node_id])
    with _connect() as conn:
        conn.execute(
            f"UPDATE nodes SET {', '.join(fields)} WHERE lecture_id = ? AND node_id = ?", values
        )
        row = conn.execute(
            "SELECT * FROM nodes WHERE lecture_id = ? AND node_id = ?", (lecture_id, node_id)
        ).fetchone()

    return _row_node(row) if row else None


def list_bookmarks():
    with _connect() as conn:
        rows = conn.execute(
            """SELECT n.node_id, n.type, n.label, n.summary, n.notes,
                      l.id AS lecture_id, l.title AS lecture_title
               FROM nodes n
               JOIN lectures l ON l.id = n.lecture_id
               WHERE n.bookmarked = 1
               ORDER BY l.created_at DESC"""
        ).fetchall()
    return [
        {
            "node_id": r["node_id"],
            "type": r["type"],
            "label": r["label"],
            "summary": r["summary"],
            "notes": r["notes"],
            "lecture_id": r["lecture_id"],
            "lecture_title": r["lecture_title"],
        }
        for r in rows
    ]


def get_stats():
    with _connect() as conn:
        total_lectures = conn.execute("SELECT COUNT(*) AS c FROM lectures").fetchone()["c"]
        total_nodes = conn.execute("SELECT COUNT(*) AS c FROM nodes").fetchone()["c"]
        total_seconds = conn.execute(
            "SELECT COALESCE(SUM(duration_seconds), 0) AS s FROM lectures"
        ).fetchone()["s"]

        now = datetime.now(timezone.utc)
        week_ago = (now - timedelta(days=7)).isoformat()
        weekly_seconds = conn.execute(
            "SELECT COALESCE(SUM(duration_seconds), 0) AS s FROM lectures WHERE created_at >= ?",
            (week_ago,),
        ).fetchone()["s"]

        lecture_dates = [
            row["created_at"][:10]
            for row in conn.execute("SELECT created_at FROM lectures").fetchall()
        ]

        type_rows = conn.execute(
            "SELECT type, COUNT(*) AS c FROM nodes GROUP BY type"
        ).fetchall()

    active_days = set(lecture_dates)
    streak = 0
    cursor = now.date()
    while cursor.isoformat() in active_days:
        streak += 1
        cursor -= timedelta(days=1)

    lectures_per_day = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date().isoformat()
        lectures_per_day.append({"date": day, "count": lecture_dates.count(day)})

    return {
        "total_lectures": total_lectures,
        "total_nodes": total_nodes,
        "total_hours": round(total_seconds / 3600, 2),
        "weekly_hours": round(weekly_seconds / 3600, 2),
        "streak_days": streak,
        "lectures_per_day": lectures_per_day,
        "node_type_breakdown": [{"type": r["type"], "count": r["c"]} for r in type_rows],
    }
