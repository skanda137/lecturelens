
export type LectureNodeType =
  | "main_topic" | "sub_topic" | "example" | "definition" | "question" | "important" | "note" | "insight";

export interface LectureJSONNode {
  id: string;
  label: string;
  type: LectureNodeType;
  summary: string;
}

export interface LectureJSONEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface LectureJSON {
  lecture_title: string;
  nodes: LectureJSONNode[];
  edges: LectureJSONEdge[];
}


const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export interface LectureJSONNodeSaved extends LectureJSONNode {
  bookmarked: boolean;
  notes: string | null;
}

export interface LectureDetail {
  id: string;
  lecture_title: string;
  created_at: string;
  duration_seconds: number | null;
  nodes: LectureJSONNodeSaved[];
  edges: LectureJSONEdge[];
}

export interface LectureSummary {
  id: string;
  title: string;
  created_at: string;
  duration_seconds: number | null;
  node_count: number;
}

export interface Stats {
  total_lectures: number;
  total_nodes: number;
  total_hours: number;
  weekly_hours: number;
  streak_days: number;
  lectures_per_day: { date: string; count: number }[];
  node_type_breakdown: { type: LectureNodeType; count: number }[];
}

export interface BookmarkEntry {
  node_id: string;
  type: LectureNodeType;
  label: string;
  summary: string;
  notes: string | null;
  lecture_id: string;
  lecture_title: string;
}

export async function processLectureAudio(file: File, durationSeconds?: number): Promise<LectureJSON & { id: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (durationSeconds != null && Number.isFinite(durationSeconds)) {
    formData.append("duration_seconds", String(durationSeconds));
  }

  return apiFetch<LectureJSON & { id: string }>("/process-audio", { method: "POST", body: formData });
}

export function processLectureText(transcript: string): Promise<LectureJSON & { id: string }> {
  return apiFetch<LectureJSON & { id: string }>("/process-text", {
    method: "POST",
    body: JSON.stringify({ text: transcript }),
  });
}

export function listLectures(): Promise<LectureSummary[]> {
  return apiFetch<LectureSummary[]>("/lectures");
}

export function getLecture(id: string): Promise<LectureDetail> {
  return apiFetch<LectureDetail>(`/lectures/${encodeURIComponent(id)}`);
}

export function deleteLecture(id: string): Promise<void> {
  return apiFetch<void>(`/lectures/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function updateNode(
  lectureId: string,
  nodeId: string,
  patch: { bookmarked?: boolean; notes?: string }
): Promise<LectureJSONNodeSaved> {
  return apiFetch<LectureJSONNodeSaved>(
    `/lectures/${encodeURIComponent(lectureId)}/nodes/${encodeURIComponent(nodeId)}`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
}

export function getStats(): Promise<Stats> {
  return apiFetch<Stats>("/stats");
}

export function listBookmarks(): Promise<BookmarkEntry[]> {
  return apiFetch<BookmarkEntry[]>("/bookmarks");
}

export interface StudyQuestion {
  question: string;
  answer: string;
}

export async function getStudyQuestions(lectureId: string): Promise<StudyQuestion[]> {
  const { questions } = await apiFetch<{ questions: StudyQuestion[] }>(
    `/lectures/${encodeURIComponent(lectureId)}/study`
  );
  return questions;
}

export type AppNodeType = "main" | "subtopic" | "example" | "definition" | "question" | "important" | "note" | "insight";

export interface AppMindNode {
  id: string;
  type: AppNodeType;
  title: string;
  summary: string;
  x: number;
  y: number;
  parentId?: string;
  timestamp: number;
  bookmarked?: boolean;
  notes?: string | null;
  transcriptSnippet?: string;
}

export interface AppEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const TYPE_MAP: Record<LectureNodeType, AppNodeType> = {
  main_topic: "main",
  sub_topic: "subtopic",
  example: "example",
  definition: "definition",
  question: "question",
  important: "important",
  note: "note",
  insight: "insight",
};

const RADIUS_STEP = 260;
const RADIAL_CENTER_X = 1200;
const RADIAL_CENTER_Y = 900;
const NODE_HALF_W = 100;
const NODE_HALF_H = 36;

/**
 * Lays nodes out as an organic radial mind map instead of a rigid left-to-right tree: each
 * root gets an angular wedge of the circle sized to its subtree, and children fan out further
 * from center within their parent's wedge — the classic hand-drawn mind-map shape rather than
 * a corporate flowchart.
 */
export function lectureJsonToGraph(json: LectureJSON): { nodes: AppMindNode[]; edges: AppEdge[] } {
  const incoming = new Set(json.edges.map(e => e.target));
  const roots = json.nodes.filter(n => !incoming.has(n.id));
  const rootIds = roots.length ? roots.map(r => r.id) : [json.nodes[0]?.id].filter(Boolean) as string[];

  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  json.edges.forEach(e => {
    childrenOf.set(e.source, [...(childrenOf.get(e.source) ?? []), e.target]);
    if (!parentOf.has(e.target)) parentOf.set(e.target, e.source);
  });

  const pos = new Map<string, { x: number; y: number }>();
  const placed = new Set<string>();

  const countLeaves = (id: string, seen: Set<string> = new Set()): number => {
    if (seen.has(id)) return 1;
    seen.add(id);
    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) return 1;
    return kids.reduce((sum, k) => sum + countLeaves(k, seen), 0);
  };

  // Multiple roots (a forest, e.g. after merging chunked extraction) fan out from a small base
  // radius instead of colliding at dead center; a single root sits at the true center.
  const baseRadius = rootIds.length > 1 ? RADIUS_STEP * 0.6 : 0;

  const placeSubtree = (id: string, depth: number, angleStart: number, angleEnd: number) => {
    if (placed.has(id)) return;
    placed.add(id);
    const angleMid = (angleStart + angleEnd) / 2;
    const radius = baseRadius + depth * RADIUS_STEP;
    pos.set(id, {
      x: RADIAL_CENTER_X + radius * Math.cos(angleMid) - NODE_HALF_W,
      y: RADIAL_CENTER_Y + radius * Math.sin(angleMid) - NODE_HALF_H,
    });

    const kids = (childrenOf.get(id) ?? []).filter(k => !placed.has(k));
    if (kids.length === 0) return;
    const weights = kids.map(k => countLeaves(k));
    const totalWeight = weights.reduce((a, b) => a + b, 0) || kids.length;
    let cursor = angleStart;
    const span = angleEnd - angleStart;
    kids.forEach((k, i) => {
      const slice = span * (weights[i] / totalWeight);
      placeSubtree(k, depth + 1, cursor, cursor + slice);
      cursor += slice;
    });
  };

  const rootWeights = rootIds.map(r => countLeaves(r));
  const totalRootWeight = rootWeights.reduce((a, b) => a + b, 0) || rootIds.length || 1;
  let rootCursor = -Math.PI / 2;
  rootIds.forEach((r, i) => {
    const slice = (2 * Math.PI) * (rootWeights[i] / totalRootWeight);
    placeSubtree(r, 0, rootCursor, rootCursor + slice);
    rootCursor += slice;
  });

  // Orphans unreachable from any root (shouldn't normally happen) get a simple grid fallback.
  let fallbackIndex = 0;
  json.nodes.forEach(n => {
    if (!placed.has(n.id)) {
      pos.set(n.id, {
        x: RADIAL_CENTER_X + 600 + (fallbackIndex % 4) * 240,
        y: RADIAL_CENTER_Y + 600 + Math.floor(fallbackIndex / 4) * 140,
      });
      placed.add(n.id);
      fallbackIndex += 1;
    }
  });

  const nodes: AppMindNode[] = json.nodes.map((n, i) => {
    const saved = n as Partial<LectureJSONNodeSaved>;
    return {
      id: n.id,
      type: TYPE_MAP[n.type] ?? "note",
      title: n.label,
      summary: n.summary,
      x: pos.get(n.id)?.x ?? RADIAL_CENTER_X,
      y: pos.get(n.id)?.y ?? RADIAL_CENTER_Y,
      parentId: parentOf.get(n.id),
      timestamp: i * 4,
      bookmarked: saved.bookmarked,
      notes: saved.notes,
    };
  });

  const edges: AppEdge[] = json.edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label }));

  return { nodes, edges };
}

export const CARS_LECTURE: LectureJSON = {
  lecture_title: "Understanding Cars: Mechanics and Dynamics",
  nodes: [
    { id: "node_1", label: "The Internal Combustion Engine", type: "main_topic", summary: "The heart of the vehicle; its core architecture, cylinder configuration, and displacement directly dictate the car's power, efficiency, and overall performance characteristics." },
    { id: "node_2", label: "Essential Supporting Systems", type: "sub_topic", summary: "An engine cannot survive alone. Vital sub-systems\u2014like cooling, lubrication, and electrical\u2014work continuously behind the scenes to prevent catastrophic failure and keep the vehicle running smoothly." },
    { id: "node_3", label: "Fuel Dynamics & Selection", type: "note", summary: "Engines are precision-engineered for specific fuel types (gasoline, diesel, or hybrid blends). Introducing the wrong fuel type can lead to severe, irreversible engine damage." },
    { id: "node_4", label: "The Transmission System", type: "sub_topic", summary: "The critical bridge between raw engine power and the wheels. It manages gear ratios to ensure the engine operates within its optimal RPM range across varying speeds." },
    { id: "node_5", label: "Maintenance & Longevity", type: "insight", summary: "Routine care\u2014such as timely oil changes, filter replacements, and belt inspections\u2014is the single most effective way to maximize a vehicle's lifespan and retain its resale value." },
  ],
  edges: [
    { id: "edge_1", source: "node_1", target: "node_2", label: "sustains engine health" },
    { id: "edge_2", source: "node_2", target: "node_3", label: "influences system design" },
    { id: "edge_3", source: "node_1", target: "node_4", label: "transfers power to" },
    { id: "edge_4", source: "node_2", target: "node_5", label: "requires proactive" },
  ],
};
