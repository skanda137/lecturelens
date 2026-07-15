
export type LectureNodeType = "main_topic" | "sub_topic" | "note" | "insight";

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
  note: "note",
  insight: "insight",
};

const LEVEL_X_STEP = 360;
const ROW_Y_STEP = 140;
const START_X = 240;
const CENTER_Y = 280;

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
  let leafCursor = 0;

  const layout = (id: string, depth: number): number => {
    placed.add(id);
    const kids = (childrenOf.get(id) ?? []).filter(childId => !placed.has(childId));
    let y: number;
    if (kids.length === 0) {
      y = leafCursor * ROW_Y_STEP;
      leafCursor += 1;
    } else {
      const childYs = kids.map(childId => layout(childId, depth + 1));
      y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
    }
    pos.set(id, { x: START_X + depth * LEVEL_X_STEP, y });
    return y;
  };

  rootIds.forEach(id => layout(id, 0));
  json.nodes.forEach(n => {
    if (!placed.has(n.id)) {
      pos.set(n.id, { x: START_X, y: leafCursor * ROW_Y_STEP });
      leafCursor += 1;
    }
  });

  const allY = [...pos.values()].map(p => p.y);
  const TOP_MARGIN = 40;
  const yOffset = allY.length ? TOP_MARGIN - Math.min(...allY) : 0;
  pos.forEach(p => { p.y += yOffset; });

  const nodes: AppMindNode[] = json.nodes.map((n, i) => {
    const saved = n as Partial<LectureJSONNodeSaved>;
    return {
      id: n.id,
      type: TYPE_MAP[n.type] ?? "note",
      title: n.label,
      summary: n.summary,
      x: pos.get(n.id)?.x ?? START_X,
      y: pos.get(n.id)?.y ?? CENTER_Y,
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
