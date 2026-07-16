import { useState, useEffect, useRef, useCallback, forwardRef, useMemo } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import {
  Brain, Mic, Upload, LayoutDashboard, History, Download,
  Settings, Search, Bell, ChevronRight, Play, Pause, Square,
  ZoomIn, ZoomOut, Maximize2, Bookmark, Copy, FileText,
  Layers, Sparkles, TrendingUp, Clock, Map, X, Command,
  BookOpen, Zap, Eye, Moon, Sun, Volume2, Keyboard,
  ArrowRight, CheckCircle, Star, Users, Globe, Shield,
  BarChart3, Activity, Plus, Filter, Tag, Hash, Link,
  ChevronDown, MoreHorizontal, RefreshCw, Minimize2,
  PanelRight, Crosshair, Grid3x3, Wifi, WifiOff,
  Trash2, AlertCircle, Loader2, Inbox, HelpCircle,
} from "lucide-react";
import {
  lectureJsonToGraph, processLectureAudio, processLectureText, CARS_LECTURE,
  listLectures, getLecture, deleteLecture, updateNode, getStats, listBookmarks, getStudyQuestions,
  type LectureSummary, type LectureDetail, type Stats, type BookmarkEntry, type LectureNodeType, type StudyQuestion,
} from "./lectureImport";
import { downloadJson, downloadMarkdown, downloadSvg, downloadPng, downloadPdf } from "./exportUtils";
import { SettingsProvider, useSettings } from "./SettingsContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "./components/ui/alert-dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";


type Page = "landing" | "dashboard" | "live" | "upload" | "mindmap" | "settings" | "lectures" | "analytics" | "bookmarks";

type NodeType = "main" | "subtopic" | "example" | "definition" | "question" | "important" | "note" | "insight";

interface MindNode {
  id: string;
  type: NodeType;
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

interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface ActiveLecture {
  id: string | null;
  title: string;
  nodes: MindNode[];
  edges: Edge[];
}


const DEFAULT_NODE_COLORS: Record<NodeType, { bg: string; border: string; glow: string; badge: string }> = {
  main:       { bg: "rgba(99,102,241,0.15)",  border: "#6366f1", glow: "rgba(99,102,241,0.4)",  badge: "bg-indigo-500/20 text-indigo-300" },
  subtopic:   { bg: "rgba(139,92,246,0.15)",  border: "#8b5cf6", glow: "rgba(139,92,246,0.4)",  badge: "bg-violet-500/20 text-violet-300" },
  example:    { bg: "rgba(16,185,129,0.15)",  border: "#10b981", glow: "rgba(16,185,129,0.4)",  badge: "bg-emerald-500/20 text-emerald-300" },
  definition: { bg: "rgba(245,158,11,0.15)",  border: "#f59e0b", glow: "rgba(245,158,11,0.4)",  badge: "bg-amber-500/20 text-amber-300" },
  question:   { bg: "rgba(236,72,153,0.15)",  border: "#ec4899", glow: "rgba(236,72,153,0.4)",  badge: "bg-pink-500/20 text-pink-300" },
  important:  { bg: "rgba(239,68,68,0.15)",   border: "#ef4444", glow: "rgba(239,68,68,0.4)",   badge: "bg-red-500/20 text-red-300" },
  note:       { bg: "rgba(20,184,166,0.15)",  border: "#14b8a6", glow: "rgba(20,184,166,0.4)",  badge: "bg-teal-500/20 text-teal-300" },
  insight:    { bg: "rgba(168,85,247,0.15)",  border: "#a855f7", glow: "rgba(168,85,247,0.4)",  badge: "bg-purple-500/20 text-purple-300" },
};

const COLORBLIND_NODE_COLORS: Record<NodeType, { bg: string; border: string; glow: string; badge: string }> = {
  main:       { bg: "#3987e526", border: "#3987e5", glow: "#3987e566", badge: "bg-[#3987e5]/20 text-[#3987e5]" },
  subtopic:   { bg: "#199e7026", border: "#199e70", glow: "#199e7066", badge: "bg-[#199e70]/20 text-[#199e70]" },
  example:    { bg: "#c9850026", border: "#c98500", glow: "#c9850066", badge: "bg-[#c98500]/20 text-[#c98500]" },
  definition: { bg: "#00830026", border: "#008300", glow: "#00830066", badge: "bg-[#008300]/20 text-[#008300]" },
  question:   { bg: "#9085e926", border: "#9085e9", glow: "#9085e966", badge: "bg-[#9085e9]/20 text-[#9085e9]" },
  important:  { bg: "#e6676726", border: "#e66767", glow: "#e6676766", badge: "bg-[#e66767]/20 text-[#e66767]" },
  note:       { bg: "#d5518126", border: "#d55181", glow: "#d5518166", badge: "bg-[#d55181]/20 text-[#d55181]" },
  insight:    { bg: "#d9592626", border: "#d95926", glow: "#d9592666", badge: "bg-[#d95926]/20 text-[#d95926]" },
};

function useNodeColors() {
  const { colorblindMode } = useSettings();
  return colorblindMode ? COLORBLIND_NODE_COLORS : DEFAULT_NODE_COLORS;
}

const NODE_ICONS: Record<NodeType, JSX.Element> = {
  main:       <Brain size={14} />,
  subtopic:   <Layers size={14} />,
  example:    <Zap size={14} />,
  definition: <BookOpen size={14} />,
  question:   <Hash size={14} />,
  important:  <Star size={14} />,
  note:       <FileText size={14} />,
  insight:    <Sparkles size={14} />,
};

const SEED_NODES: MindNode[] = [
  { id: "n1", type: "main",       title: "Machine Learning Fundamentals", summary: "Core principles of ML algorithms and statistical learning theory", x: 400, y: 280, timestamp: 0, transcriptSnippet: "Today we explore the foundational pillars of machine learning, starting with supervised learning..." },
  { id: "n2", type: "subtopic",   title: "Supervised Learning",           summary: "Training with labeled data to predict outcomes", x: 680, y: 160, parentId: "n1", timestamp: 4, transcriptSnippet: "Supervised learning requires labeled training data..." },
  { id: "n3", type: "subtopic",   title: "Unsupervised Learning",         summary: "Finding hidden patterns in unlabeled data", x: 680, y: 380, parentId: "n1", timestamp: 8 },
  { id: "n4", type: "definition", title: "Gradient Descent",              summary: "Optimization algorithm minimizing loss function iteratively", x: 940, y: 100, parentId: "n2", timestamp: 12, transcriptSnippet: "Gradient descent iteratively adjusts parameters by moving in the direction of steepest descent..." },
  { id: "n5", type: "example",    title: "Linear Regression Demo",        summary: "Predicting house prices using square footage", x: 940, y: 220, parentId: "n2", timestamp: 16 },
  { id: "n6", type: "example",    title: "K-Means Clustering",            summary: "Grouping similar data points without labels", x: 940, y: 340, parentId: "n3", timestamp: 20 },
  { id: "n7", type: "important",  title: "Bias-Variance Tradeoff",        summary: "Balancing model complexity vs. generalization error", x: 940, y: 460, parentId: "n3", timestamp: 24, transcriptSnippet: "This is critical — a model that fits training data perfectly may fail on unseen data..." },
  { id: "n8", type: "question",   title: "How do we prevent overfitting?", summary: "Regularization, cross-validation, early stopping", x: 1180, y: 100, parentId: "n4", timestamp: 28 },
  { id: "n9", type: "definition", title: "Backpropagation",               summary: "Algorithm computing gradients through neural network layers", x: 1180, y: 220, parentId: "n4", timestamp: 32 },
];

const SEED_EDGES: Edge[] = [
  { id: "e1-2", source: "n1", target: "n2", label: "includes" },
  { id: "e1-3", source: "n1", target: "n3", label: "includes" },
  { id: "e2-4", source: "n2", target: "n4", label: "relies on" },
  { id: "e2-5", source: "n2", target: "n5", label: "example" },
  { id: "e3-6", source: "n3", target: "n6", label: "example" },
  { id: "e3-7", source: "n3", target: "n7", label: "raises" },
  { id: "e4-8", source: "n4", target: "n8", label: "raises" },
  { id: "e4-9", source: "n4", target: "n9", label: "requires" },
];

const FEATURES = [
  { icon: <Brain size={22} />,    title: "AI Concept Extraction",   desc: "Our model detects topics, definitions, examples, and questions — categorized and color-coded automatically.", color: "#6366f1" },
  { icon: <Map size={22} />,      title: "Live Mind Maps",           desc: "Watch your knowledge graph grow in real-time as the lecture progresses. Never stare at a wall of text again.", color: "#8b5cf6" },
  { icon: <Shield size={22} />,   title: "Accessibility First",      desc: "Built for ADHD, dyslexia, and hard-of-hearing learners. Large text, high contrast, keyboard navigation included.", color: "#06b6d4" },
  { icon: <Zap size={22} />,      title: "Instant Understanding",    desc: "Each node includes a summary, transcript snippet, AI explanation, and quiz generator.", color: "#10b981" },
  { icon: <Download size={22} />, title: "Export Anywhere",          desc: "Export as PNG, PDF, SVG, Markdown, or JSON. Share with classmates or import into Notion.", color: "#f59e0b" },
  { icon: <Globe size={22} />,    title: "Works Universally",        desc: "Upload pre-recorded videos or stream live lectures. Supports 40+ languages.", color: "#ec4899" },
];

const TESTIMONIALS = [
  { name: "Aisha Okonkwo",    role: "Computer Science, MIT",         quote: "LectureLens changed how I learn. As someone with ADHD, visual maps let me actually follow complex lectures.", avatar: "AO", color: "#6366f1" },
  { name: "Marcus Chen",      role: "Neuroscience, Stanford",        quote: "I have dyslexia. Reading long transcripts was torture. Now I understand everything visually the moment class ends.", avatar: "MC", color: "#8b5cf6" },
  { name: "Priya Ramaswamy",  role: "Physics, Cambridge",            quote: "The AI confidence heatmap tells me what to study first. My grades went from C+ to A in one semester.", avatar: "PR", color: "#06b6d4" },
];


function GlassCard({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <motion.div
      className={`rounded-[1.35rem] border border-slate-200/80 bg-white/80 shadow-[0_20px_45px_rgba(15,23,42,0.06)] backdrop-blur-xl ${className}`}
      whileHover={onClick ? { y: -2, scale: 1.01, boxShadow: "0 24px 55px rgba(15,23,42,0.09)" } : {}}
      onClick={onClick}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

function GradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`bg-gradient-to-r from-slate-800 via-violet-600 to-cyan-600 bg-clip-text text-transparent ${className}`}>
      {children}
    </span>
  );
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

const LECTURE_TYPE_TO_APP_TYPE: Record<LectureNodeType, NodeType> = {
  main_topic: "main",
  sub_topic: "subtopic",
  note: "note",
  insight: "insight",
};

function typeToAppType(type: LectureNodeType): NodeType {
  return LECTURE_TYPE_TO_APP_TYPE[type] ?? "note";
}

function Badge({ type }: { type: NodeType }) {
  const c = useNodeColors()[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${c.badge}`}>
      {NODE_ICONS[type]}
      {type}
    </span>
  );
}


function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <div className="absolute -top-24 -left-24 w-[760px] h-[760px] rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)", filter: "blur(70px)", animation: "float1 20s ease-in-out infinite" }} />
      <div className="absolute top-1/2 -right-20 w-[620px] h-[620px] rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, rgba(125,211,252,0.22) 0%, transparent 72%)", filter: "blur(70px)", animation: "float2 24s ease-in-out infinite" }} />
      <div className="absolute -bottom-20 left-1/3 w-[540px] h-[540px] rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, rgba(192,132,252,0.18) 0%, transparent 72%)", filter: "blur(70px)", animation: "float3 26s ease-in-out infinite" }} />
      <div className="absolute inset-0 opacity-35"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.05) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
      <style>{`
        @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(50px,-36px) scale(1.03)} 66%{transform:translate(-28px,46px) scale(0.98)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-46px,28px) scale(1.05)} }
        @keyframes float3 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(34px,-52px) scale(1.02)} 80%{transform:translate(-18px,20px) scale(0.97)} }
      `}</style>
    </div>
  );
}


function FloatingNodes() {
  const nodes = [
    { label: "Gradient Descent", type: "definition" as NodeType, x: 8,  y: 20, delay: 0 },
    { label: "Neural Networks",  type: "main" as NodeType,       x: 72, y: 15, delay: 1.2 },
    { label: "Backpropagation",  type: "subtopic" as NodeType,   x: 85, y: 55, delay: 0.6 },
    { label: "Overfitting?",     type: "question" as NodeType,   x: 5,  y: 65, delay: 1.8 },
    { label: "Example: CNN",     type: "example" as NodeType,    x: 60, y: 78, delay: 0.9 },
    { label: "Key: Attention",   type: "important" as NodeType,  x: 25, y: 82, delay: 1.5 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {nodes.map((n, i) => {
        const c = DEFAULT_NODE_COLORS[n.type];
        return (
          <motion.div
            key={i}
            className="absolute px-3 py-1.5 rounded-xl text-xs font-medium border backdrop-blur-md"
            style={{ left: `${n.x}%`, top: `${n.y}%`, background: c.bg, borderColor: c.border, color: "#e4e4e7", boxShadow: `0 0 20px ${c.glow}` }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: [0.6, 0.9, 0.6], y: [0, -12, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: n.delay, ease: "easeInOut" }}
          >
            {n.label}
          </motion.div>
        );
      })}
    </div>
  );
}


function useAudioLevels(stream: MediaStream | null, barCount: number): number[] {
  const [levels, setLevels] = useState<number[]>(() => Array(barCount).fill(4));

  useEffect(() => {
    if (!stream) {
      setLevels(Array(barCount).fill(4));
      return;
    }
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const step = Math.max(1, Math.floor(data.length / barCount));
    let raf = 0;
    let lastUpdate = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - lastUpdate < 80) return;
      lastUpdate = t;
      analyser.getByteFrequencyData(data);
      setLevels(Array.from({ length: barCount }, (_, i) => Math.max(4, Math.min(56, (data[i * step] / 255) * 56))));
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      analyser.disconnect();
      audioCtx.close();
    };
  }, [stream, barCount]);

  return levels;
}

function Waveform({ stream, active }: { stream: MediaStream | null; active: boolean }) {
  const levels = useAudioLevels(active ? stream : null, 40);
  return (
    <div className="flex items-center gap-0.5 h-16">
      {levels.map((h, i) => (
        <div
          key={i}
          className="rounded-full w-1.5 transition-all duration-100"
          style={{ height: active ? h : 4, background: "linear-gradient(180deg, #6366f1, #8b5cf6)" }}
        />
      ))}
    </div>
  );
}


function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    refs.forEach(r => {
      if (!r) return;
      if (typeof r === "function") r(node);
      else (r as React.MutableRefObject<T | null>).current = node;
    });
  };
}

const MiniMindMap = forwardRef<SVGSVGElement, {
  nodes: MindNode[];
  edges: Edge[];
  selectedId: string | null;
  onNodeClick: (n: MindNode) => void;
  newNodeId: string | null;
  autoCenter?: boolean;
}>(function MiniMindMap({ nodes, edges, selectedId, onNodeClick, newNodeId, autoCenter = true }, forwardedRef) {
  const [pan, setPan] = useState({ x: -200, y: -100 });
  const [zoom, setZoom] = useState(0.72);
  const [showGrid, setShowGrid] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const colors = useNodeColors();

  const fitToView = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || nodes.length === 0) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + 200));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + 72));
    const pad = 80;
    const fitZoom = Math.max(0.3, Math.min(1, Math.min((rect.width - pad) / (maxX - minX || 1), (rect.height - pad) / (maxY - minY || 1))));
    setZoom(fitZoom);
    setPan({ x: rect.width / 2 - ((minX + maxX) / 2) * fitZoom, y: rect.height / 2 - ((minY + maxY) / 2) * fitZoom });
  }, [nodes]);

  const hasFitRef = useRef(false);
  const prevCountRef = useRef(0);
  useEffect(() => {
    const shouldFit = !hasFitRef.current || (prevCountRef.current === 0 && nodes.length > 0);
    prevCountRef.current = nodes.length;
    if (nodes.length === 0 || !shouldFit) return;
    hasFitRef.current = true;
    fitToView();
  }, [nodes.length]);

  useEffect(() => {
    if (!autoCenter || !newNodeId) return;
    const node = nodes.find(n => n.id === newNodeId);
    const svg = svgRef.current;
    if (!node || !svg) return;
    const rect = svg.getBoundingClientRect();
    setPan({ x: rect.width / 2 - (node.x + 100) * zoom, y: rect.height / 2 - (node.y + 36) * zoom });
  }, [newNodeId, autoCenter]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(2, z - e.deltaY * 0.001)));
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest(".node-hit")) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan(p => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseUp = () => { dragging.current = false; };

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl" style={{ cursor: dragging.current ? "grabbing" : "grab" }}>
      <svg
        ref={mergeRefs(svgRef, forwardedRef)}
        className="w-full h-full"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.07)" />
          </pattern>
          {Object.entries(colors).map(([type, c]) => (
            <filter key={type} id={`glow-${type}`}>
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#7dd3fc" />
          </marker>
        </defs>

        {showGrid && <rect width="100%" height="100%" fill="url(#dots)" />}

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {edges.map(e => {
            const s = nodeMap[e.source];
            const t = nodeMap[e.target];
            if (!s || !t) return null;
            const sx = s.x + 100, sy = s.y + 36;
            const tx = t.x + 100, ty = t.y + 36;
            const mx = (sx + tx) / 2;
            const my = (sy + ty) / 2;
            const path = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
            const isNew = e.target === newNodeId;
            const label = e.label && e.label.length > 22 ? e.label.slice(0, 22) + "…" : e.label;
            const labelWidth = label ? Math.max(36, label.length * 6.2 + 16) : 0;
            return (
              <g key={e.id}>
                <motion.path
                  d={path}
                  fill="none"
                  stroke="url(#edgeGrad)"
                  strokeWidth="2.5"
                  strokeOpacity="0.85"
                  markerEnd="url(#arrow)"
                  initial={isNew ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
                {label && (
                  <g transform={`translate(${mx - labelWidth / 2}, ${my - 9})`} pointerEvents="none">
                    <rect width={labelWidth} height={18} rx={5} fill="#12172a" stroke="rgba(125,211,252,0.3)" strokeWidth="1" />
                    <text x={labelWidth / 2} y={13} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontFamily="Inter,sans-serif">
                      {label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          <defs>
            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>

          {nodes.map(node => {
            const c = colors[node.type];
            const isSelected = selectedId === node.id;
            const isNew = newNodeId === node.id;
            const isMain = node.type === "main";
            return (
              <motion.g
                key={node.id}
                className="node-hit"
                initial={isNew ? { opacity: 0, scale: 0, x: node.x + 100, y: node.y + 36 } : { opacity: 1, scale: 1, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                transition={{ duration: 0.5, type: "spring", bounce: 0.35 }}
                style={{ cursor: "pointer" }}
                onClick={() => onNodeClick(node)}
              >
                {isMain ? (
                  <motion.ellipse
                    cx={node.x + 100} cy={node.y + 36} rx={100} ry={36}
                    fill={c.bg}
                    stroke={isSelected ? c.border : "rgba(255,255,255,0.1)"}
                    strokeWidth={isSelected ? 1.5 : 1}
                    filter={isNew || isSelected ? `url(#glow-${node.type})` : "none"}
                    whileHover={{ filter: `url(#glow-${node.type})` }}
                  />
                ) : (
                  <motion.rect
                    x={node.x} y={node.y} width={200} height={72}
                    rx={14} ry={14}
                    fill={c.bg}
                    stroke={isSelected ? c.border : "rgba(255,255,255,0.1)"}
                    strokeWidth={isSelected ? 1.5 : 1}
                    filter={isNew || isSelected ? `url(#glow-${node.type})` : "none"}
                    whileHover={{ filter: `url(#glow-${node.type})` }}
                  />
                )}
                {isSelected && (
                  isMain ? (
                    <ellipse cx={node.x + 100} cy={node.y + 36} rx={100} ry={36}
                      fill="none" stroke={c.border} strokeWidth="1.5" opacity="0.6" />
                  ) : (
                    <rect x={node.x} y={node.y} width={200} height={72} rx={14} ry={14}
                      fill="none" stroke={c.border} strokeWidth="1.5" opacity="0.6" />
                  )
                )}
                {!isMain && (
                  <rect x={node.x + 12} y={node.y + 12} width={4} height={48} rx={2} fill={c.border} opacity={0.8} />
                )}
                <text x={node.x + 26} y={node.y + 30} fill="#f4f4f5" fontSize="11" fontWeight="600" fontFamily="Inter,sans-serif">
                  {node.title.length > 22 ? node.title.slice(0, 22) + "…" : node.title}
                </text>
                <text x={node.x + 26} y={node.y + 46} fill="#a1a1aa" fontSize="9.5" fontFamily="Inter,sans-serif">
                  {node.summary.length > 28 ? node.summary.slice(0, 28) + "…" : node.summary}
                </text>
                {node.bookmarked && (
                  <text x={node.x + 182} y={node.y + 18} fill="#f59e0b" fontSize="12">★</text>
                )}
                {isNew && (
                  <motion.circle
                    cx={node.x + 200} cy={node.y}
                    r={5} fill={c.border}
                    animate={{ opacity: [1, 0], scale: [1, 3] }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                )}
              </motion.g>
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
        {[
          { icon: <ZoomIn size={14} />,    action: () => setZoom(z => Math.min(2, z + 0.1)), active: false },
          { icon: <ZoomOut size={14} />,   action: () => setZoom(z => Math.max(0.3, z - 0.1)), active: false },
          { icon: <Crosshair size={14} />, action: fitToView, active: false },
          { icon: <Grid3x3 size={14} />,   action: () => setShowGrid(g => !g), active: showGrid },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all backdrop-blur-md ${
              btn.active ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-300" : "border-white/10 bg-zinc-900/80 text-zinc-400 hover:text-white hover:border-white/20"
            }`}>
            {btn.icon}
          </button>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 w-28 h-20 rounded-xl border border-white/10 bg-zinc-900/80 backdrop-blur-md overflow-hidden">
        <svg width="100%" height="100%" viewBox="-100 -50 1400 600">
          {nodes.map(n => {
            const c = colors[n.type];
            return <rect key={n.id} x={n.x} y={n.y} width={200} height={72} rx={8} fill={c.border} opacity={selectedId === n.id ? 0.8 : 0.3} />;
          })}
          {selectedId && nodes.find(n => n.id === selectedId) && (
            <rect
              x={nodes.find(n => n.id === selectedId)!.x - 10}
              y={nodes.find(n => n.id === selectedId)!.y - 10}
              width={220} height={92} rx={10}
              fill="none" stroke="white" strokeWidth="4" opacity="0.6"
            />
          )}
        </svg>
      </div>
    </div>
  );
});
MiniMindMap.displayName = "MiniMindMap";


function NodeSidebar({ node, onClose, onBookmark, onSaveNotes }: {
  node: MindNode;
  onClose: () => void;
  onBookmark: (id: string) => void;
  onSaveNotes: (id: string, notes: string) => Promise<void>;
}) {
  const c = useNodeColors()[node.type];
  const [activeTab, setActiveTab] = useState<"summary" | "notes">("summary");
  const [copied, setCopied] = useState(false);
  const [notesDraft, setNotesDraft] = useState(node.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    setNotesDraft(node.notes ?? "");
    setNotesSaved(false);
  }, [node.id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(`${node.title}\n${node.summary}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await onSaveNotes(node.id, notesDraft);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <motion.div
      className="absolute right-0 top-0 h-full w-80 border-l border-white/8 bg-zinc-950/95 backdrop-blur-xl overflow-y-auto"
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
    >
      <div className="p-5 border-b border-white/8">
        <div className="flex items-start justify-between mb-3">
          <Badge type={node.type} />
          <div className="flex gap-1.5">
            <button onClick={() => onBookmark(node.id)}
              className={`p-1.5 rounded-lg border transition-all ${node.bookmarked ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-white/10 text-zinc-500 hover:text-white"}`}>
              <Bookmark size={13} />
            </button>
            <button onClick={handleCopy}
              className="p-1.5 rounded-lg border border-white/10 text-zinc-500 hover:text-white transition-all">
              {copied ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
            <button onClick={onClose}
              className="p-1.5 rounded-lg border border-white/10 text-zinc-500 hover:text-white transition-all">
              <X size={13} />
            </button>
          </div>
        </div>
        <h3 className="text-base font-semibold text-white leading-snug">{node.title}</h3>
      </div>

      <div className="flex border-b border-white/8">
        {(["summary", "notes"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-all ${activeTab === tab ? "text-white border-b-2" : "text-zinc-500 hover:text-zinc-300"}`}
            style={activeTab === tab ? { borderBottomColor: c.border } : {}}>
            {tab}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {activeTab === "summary" && (
          <>
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">AI Summary</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{node.summary}</p>
            </div>
            {node.transcriptSnippet && (
              <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                <p className="text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wide">Transcript</p>
                <p className="text-xs text-zinc-400 leading-relaxed italic">"{node.transcriptSnippet}"</p>
              </div>
            )}
          </>
        )}
        {activeTab === "notes" && (
          <div className="space-y-3">
            <textarea
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              placeholder="Add your notes here..."
              className="w-full h-40 bg-white/3 border border-white/8 rounded-xl p-3 text-sm text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-white/20 transition-all"
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600/30 border border-indigo-500/40 hover:bg-indigo-600/50 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {savingNotes ? (
                <><Loader2 size={14} className="animate-spin" /> Saving...</>
              ) : notesSaved ? (
                <><CheckCircle size={14} className="text-emerald-400" /> Saved</>
              ) : (
                "Save Notes"
              )}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}


function CommandPalette({ onClose, onNavigate, onToggleFocusMode }: {
  onClose: () => void;
  onNavigate: (p: Page) => void;
  onToggleFocusMode: () => void;
}) {
  const [query, setQuery] = useState("");
  const commands = [
    { icon: <LayoutDashboard size={15} />, label: "Go to Dashboard",    action: () => onNavigate("dashboard") },
    { icon: <Mic size={15} />,             label: "Start Live Lecture", action: () => onNavigate("live") },
    { icon: <Upload size={15} />,          label: "Upload Video",       action: () => onNavigate("upload") },
    { icon: <History size={15} />,         label: "My Lectures",        action: () => onNavigate("lectures") },
    { icon: <BarChart3 size={15} />,       label: "Analytics",          action: () => onNavigate("analytics") },
    { icon: <Bookmark size={15} />,        label: "Bookmarks",          action: () => onNavigate("bookmarks") },
    { icon: <Settings size={15} />,        label: "Settings",           action: () => onNavigate("settings") },
    {
      icon: <Maximize2 size={15} />, label: "Toggle Fullscreen",
      action: () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      },
    },
    { icon: <Eye size={15} />,             label: "Focus Mode",         action: onToggleFocusMode },
  ];
  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-lg rounded-2xl border border-white/12 overflow-hidden"
        style={{ background: "rgba(18,18,22,0.98)", boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)" }}
        initial={{ y: -20, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: -20, scale: 0.97 }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <Search size={16} className="text-zinc-500" />
          <input autoFocus className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
            placeholder="Search commands..." value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Escape" && onClose()} />
          <kbd className="px-1.5 py-0.5 rounded border border-white/10 text-[10px] text-zinc-500">ESC</kbd>
        </div>
        <div className="p-2 max-h-72 overflow-y-auto">
          {filtered.map((cmd, i) => (
            <button key={i} onClick={() => { cmd.action(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-white/6 transition-all text-left">
              <span className="text-zinc-500">{cmd.icon}</span>
              {cmd.label}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}


function ExportModal({ onClose, title, nodes, edges, svgRef }: {
  onClose: () => void;
  title: string;
  nodes: MindNode[];
  edges: Edge[];
  svgRef: React.RefObject<SVGSVGElement>;
}) {
  const [selected, setSelected] = useState("PNG");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formats = [
    { label: "PNG",      desc: "High-resolution image",  icon: "🖼️" },
    { label: "PDF",      desc: "Print-ready document",   icon: "📄" },
    { label: "SVG",      desc: "Scalable vector",        icon: "✦" },
    { label: "JSON",     desc: "Raw data export",        icon: "{ }" },
    { label: "Markdown", desc: "Text-based outline",     icon: "Md" },
  ];

  const handleExport = async () => {
    setError(null);
    setExporting(true);
    try {
      const svg = svgRef.current;
      switch (selected) {
        case "JSON":
          downloadJson(title, nodes, edges);
          break;
        case "Markdown":
          downloadMarkdown(title, nodes);
          break;
        case "SVG":
          if (!svg) throw new Error("The mind map isn't ready to export yet.");
          downloadSvg(svg, title);
          break;
        case "PNG":
          if (!svg) throw new Error("The mind map isn't ready to export yet.");
          await downloadPng(svg, title);
          break;
        case "PDF":
          if (!svg) throw new Error("The mind map isn't ready to export yet.");
          await downloadPdf(svg, title, nodes);
          break;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-md rounded-2xl border border-white/12 overflow-hidden"
        style={{ background: "rgba(18,18,22,0.98)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h3 className="text-base font-semibold text-white">Export Mind Map</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/6 transition-all"><X size={15} /></button>
        </div>
        <div className="p-6 space-y-3">
          {formats.map(f => (
            <button key={f.label} onClick={() => setSelected(f.label)}
              className={`w-full flex items-center gap-4 p-3.5 rounded-xl border transition-all ${selected === f.label ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/8 hover:border-white/15 hover:bg-white/3"}`}>
              <span className="text-lg font-mono w-8 text-center">{f.icon}</span>
              <div className="text-left">
                <p className={`text-sm font-medium ${selected === f.label ? "text-white" : "text-zinc-300"}`}>{f.label}</p>
                <p className="text-xs text-zinc-500">{f.desc}</p>
              </div>
              {selected === f.label && <CheckCircle size={15} className="ml-auto text-indigo-400" />}
            </button>
          ))}
        </div>
        <div className="px-6 pb-6">
          {error && (
            <p className="text-xs text-red-400 mb-3 flex items-center gap-1.5"><AlertCircle size={12} /> {error}</p>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            {exporting ? (<><Loader2 size={15} className="animate-spin" /> Exporting...</>) : `Export as ${selected}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}


function StudyModal({ onClose, lectureId, lectureTitle }: { onClose: () => void; lectureId: string; lectureTitle: string }) {
  const [questions, setQuestions] = useState<StudyQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getStudyQuestions(lectureId)
      .then(qs => { if (!cancelled) setQuestions(qs); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't generate study questions."); });
    return () => { cancelled = true; };
  }, [lectureId]);

  const toggleReveal = (i: number) => {
    setRevealed(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-lg max-h-[80vh] rounded-2xl border border-white/12 overflow-hidden flex flex-col"
        style={{ background: "rgba(18,18,22,0.98)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Study Questions</h3>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">{lectureTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/6 transition-all flex-shrink-0"><X size={15} /></button>
        </div>

        <div className="p-6 space-y-3 overflow-y-auto">
          {error && (
            <p className="text-sm text-red-400 flex items-center gap-2"><AlertCircle size={14} /> {error}</p>
          )}
          {!error && questions === null && (
            <div className="py-10 flex flex-col items-center gap-3 text-zinc-400 text-sm">
              <Loader2 size={20} className="animate-spin" />
              Generating questions from this lecture...
            </div>
          )}
          {!error && questions !== null && questions.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-10">No study questions could be generated for this lecture.</p>
          )}
          {questions?.map((q, i) => (
            <div key={i} className="rounded-xl border border-white/8 bg-white/3 p-4">
              <p className="text-sm text-zinc-200 leading-relaxed mb-2">{i + 1}. {q.question}</p>
              {revealed.has(i) ? (
                <p className="text-sm text-emerald-300 leading-relaxed">{q.answer}</p>
              ) : (
                <button onClick={() => toggleReveal(i)}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-all">
                  Reveal answer
                </button>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}


function AppSidebar({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  const [expanded, setExpanded] = useState(false);

  const navItems: { icon: JSX.Element; label: string; page: Page }[] = [
    { icon: <LayoutDashboard size={19} />, label: "Dashboard", page: "dashboard" },
    { icon: <Mic size={19} />,             label: "Record",       page: "live" },
    { icon: <Upload size={19} />,          label: "Upload",    page: "upload" },
    { icon: <History size={19} />,         label: "My Lectures",  page: "lectures" },
    { icon: <BarChart3 size={19} />,       label: "Analytics",   page: "analytics" },
    { icon: <Bookmark size={19} />,        label: "Bookmarks",   page: "bookmarks" },
  ];

  return (
    <motion.div 
      className="relative h-full flex flex-col items-center py-6 rounded-r-3xl"
      style={{ width: expanded ? 280 : 88 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      animate={{ width: expanded ? 280 : 88 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="absolute inset-0 rounded-r-3xl bg-white/40 border border-white/30 backdrop-blur-xl -z-10" 
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }} />

      <motion.button 
        onClick={() => onNavigate("landing")}
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-8 relative group"
        style={{ background: "linear-gradient(135deg, #6D5EF7, #7C3AED)" }}
        whileHover={{ scale: 1.1, boxShadow: "0 20px 40px rgba(109,94,247,0.3)" }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
          <Brain size={22} className="text-white" />
        </motion.div>
      </motion.button>

      <nav className="flex-1 flex flex-col gap-2 w-full px-3">
        {navItems.map((item, idx) => (
          <motion.button 
            key={item.label} 
            onClick={() => onNavigate(item.page)}
            className={`relative group flex items-center gap-3 px-3 py-3 rounded-2xl transition-all ${
              page === item.page 
                ? "text-white" 
                : "text-gray-600 hover:text-gray-900"
            }`}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.95 }}
          >
            {page === item.page && (
              <motion.div 
                className="absolute inset-0 rounded-2xl -z-10"
                style={{ background: "linear-gradient(135deg, #6D5EF7, #7C3AED)" }}
                layoutId="sidebarActivePill"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}

            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
              page === item.page 
                ? "bg-white/20" 
                : "bg-gray-100/60 group-hover:bg-gray-200/60"
            }`}>
              {item.icon}
            </div>

            {expanded && (
              <motion.span 
                className="text-sm font-medium whitespace-nowrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {item.label}
              </motion.span>
            )}
          </motion.button>
        ))}
      </nav>

      <div className="w-full px-3 space-y-2 pt-4 border-t border-white/20">
        <motion.button 
          onClick={() => onNavigate("settings")}
          className={`relative group flex items-center gap-3 w-full px-3 py-3 rounded-2xl transition-all ${
            page === "settings" 
              ? "text-white bg-gradient-to-r from-blue-500/40 to-cyan-500/40" 
              : "text-gray-600 hover:text-gray-900"
          }`}
          whileHover={{ x: 4 }}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            page === "settings" 
              ? "bg-white/20" 
              : "bg-gray-100/60"
          }`}>
            <Settings size={19} />
          </div>
          {expanded && (
            <motion.span 
              className="text-sm font-medium whitespace-nowrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              Settings
            </motion.span>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}


function TopBar({ title, onCommandPalette, onExport }: { title: string; onCommandPalette: () => void; onExport?: () => void }) {
  return (
    <motion.div 
      className="h-16 border-b border-white/10 flex items-center px-8 gap-6"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)"
      }}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
    >
      <div className="absolute inset-0 backdrop-blur-xl -z-10" />
      
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-display text-gray-900">{title}</h1>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <motion.button 
          onClick={onCommandPalette}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/30 bg-white/50 hover:bg-white/70 text-gray-600 text-sm transition-all hover:shadow-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Search size={16} />
          <span className="text-gray-500">Search</span>
          <kbd className="ml-2 px-2 py-0.5 rounded border border-gray-300 text-xs text-gray-400 bg-gray-50">⌘K</kbd>
        </motion.button>

        {onExport && (
          <motion.button 
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
            style={{ background: "linear-gradient(135deg, #6D5EF7, #7C3AED)" }}
            whileHover={{ scale: 1.02, boxShadow: "0 10px 30px rgba(109,94,247,0.2)" }}
            whileTap={{ scale: 0.98 }}
          >
            <Download size={16} />
            Export
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}


function LandingPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const timelineSteps = [
    { icon: <Volume2 size={18} />,    label: "Audio Input",         desc: "Live or recorded lecture" },
    { icon: <Activity size={18} />,   label: "AI Processing",       desc: "Transcription + NLP" },
    { icon: <Layers size={18} />,     label: "Hierarchy Detection", desc: "Topics & subtopics" },
    { icon: <Map size={18} />,        label: "Mind Map",            desc: "Visual knowledge graph" },
    { icon: <Brain size={18} />,      label: "Understanding",       desc: "Student comprehension" },
  ];

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <AnimatedBackground />

      <nav className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
            <Brain size={16} className="text-white" />
          </div>
          <span className="font-semibold text-slate-900 text-base">LectureLens</span>
        </div>
        <div className="flex items-center gap-6">
          {["Features", "Accessibility"].map(l => (
            <a key={l} href="#" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <motion.button onClick={() => onNavigate("dashboard")}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 10px 24px rgba(79,70,229,0.18)" }}
            whileHover={{ scale: 1.03, boxShadow: "0 14px 30px rgba(79,70,229,0.24)" }}
            whileTap={{ scale: 0.97 }}>
            Get started free
          </motion.button>
        </div>
      </nav>

      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-32">
        <FloatingNodes />

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700 text-xs font-medium mb-8 shadow-sm">
            <Sparkles size={11} />
            Now with GPT-4o Audio — Real-time transcription in 40+ languages
          </div>
          <h1 className="text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.05] tracking-tight mb-6 max-w-4xl">
            Turn Lectures Into<br /><GradientText>Visual Thinking</GradientText>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl leading-relaxed mb-10">
            A calmer, more thoughtful study companion that turns lectures into structured maps,
            highlights, and review paths — without feeling like a gimmick.
          </p>
          <div className="flex items-center gap-4 justify-center flex-wrap">
            <motion.button onClick={() => onNavigate("live")}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 12px 28px rgba(79,70,229,0.2)" }}
              whileHover={{ scale: 1.04, boxShadow: "0 16px 36px rgba(79,70,229,0.24)" }}
              whileTap={{ scale: 0.97 }}>
              <Mic size={16} /> Try Live Demo
            </motion.button>
            <motion.button onClick={() => onNavigate("upload")}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-200 hover:border-slate-300 hover:text-slate-900 transition-all bg-white/80 backdrop-blur-md shadow-sm"
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Upload size={16} /> Upload Lecture
            </motion.button>
          </div>
        </motion.div>

        <motion.div className="relative mt-20 w-full max-w-5xl"
          initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
          <div className="absolute inset-0 rounded-2xl blur-2xl opacity-30" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)" }} />
          <div className="relative rounded-[1.5rem] border border-slate-200/80 overflow-hidden bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-200 bg-slate-50/80">
              {["#ef4444", "#f59e0b", "#10b981"].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}
              <span className="ml-3 text-xs text-slate-500">ML Fundamentals — Live Session</span>
            </div>
            <div className="h-72 bg-white/70 relative overflow-hidden">
              <MiniMindMap nodes={SEED_NODES.slice(0, 7)} edges={SEED_EDGES.slice(0, 6)} selectedId={null} onNodeClick={() => {}} newNodeId={null} />
            </div>
          </div>
        </motion.div>
      </section>

      <section className="relative z-10 px-8 py-24 max-w-6xl mx-auto">
        <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Everything you need to learn better</h2>
          <p className="text-slate-600 text-lg">Designed from the ground up with visibility, clarity, and calm in mind.</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
              <GlassCard className="p-6 h-full cursor-pointer group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all group-hover:scale-110"
                  style={{ background: `${f.color}20`, border: `1px solid ${f.color}40` }}>
                  <span style={{ color: f.color }}>{f.icon}</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-8 py-24 max-w-5xl mx-auto">
        <motion.div className="text-center mb-16" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">From audio to understanding</h2>
          <p className="text-slate-600">Five steps. Zero effort from the student.</p>
        </motion.div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {timelineSteps.map((step, i) => (
            <motion.div key={i} className="flex flex-col items-center text-center flex-1"
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 relative"
                style={{ background: `rgba(99,102,241,${0.1 + i * 0.06})`, border: "1px solid rgba(99,102,241,0.3)", boxShadow: `0 0 ${16 + i * 6}px rgba(99,102,241,${0.1 + i * 0.06})` }}>
                <span className="text-indigo-300">{step.icon}</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 mb-1">{step.label}</p>
              <p className="text-xs text-slate-500">{step.desc}</p>
              {i < timelineSteps.length - 1 && (
                <div className="hidden md:flex absolute items-center" style={{ left: "calc(50% + 3.5rem + 8px)", top: "1.75rem", width: "calc(100% - 7rem - 16px)" }}>
                  <ArrowRight size={14} className="text-indigo-500/50 mx-auto" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-8 py-24 max-w-5xl mx-auto">
        <motion.div className="text-center mb-16" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Students who finally get it</h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <GlassCard className="p-6 h-full">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={12} className="text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-5 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}88)` }}>{t.avatar}</div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-8 py-24 text-center">
        <GlassCard className="max-w-3xl mx-auto p-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Start learning visually today.</h2>
          <p className="text-slate-600 mb-8">Free for students. No credit card required.</p>
          <motion.button onClick={() => onNavigate("dashboard")}
            className="px-8 py-4 rounded-xl text-base font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 12px 28px rgba(79,70,229,0.2)" }}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            Get started — it&apos;s free
          </motion.button>
        </GlassCard>
      </section>

      <footer className="relative z-10 border-t border-slate-200/80 px-8 py-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-violet-600" />
          <span className="text-sm text-slate-500">LectureLens © 2025</span>
        </div>
        <div className="flex gap-6">
          {["Privacy", "Terms", "Accessibility"].map(l => (
            <a key={l} href="#" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}


function Dashboard({ onNavigate, onCommandPalette, onOpenLecture }: {
  onNavigate: (p: Page) => void;
  onCommandPalette: () => void;
  onOpenLecture: (id: string) => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lectures, setLectures] = useState<LectureSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getStats(), listLectures()])
      .then(([s, l]) => { if (!cancelled) { setStats(s); setLectures(l); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your dashboard."); });
    return () => { cancelled = true; };
  }, []);

  const recent = (lectures ?? []).slice(0, 4);
  const loading = stats === null && lectures === null && !error;

  return (
    <div className="flex-1 overflow-y-auto">
      <motion.div
        className="relative px-8 pt-8 pb-12 bg-gradient-to-br from-purple-50/50 to-blue-50/30 border-b border-white/20"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <h1 className="text-5xl font-display text-gray-900 mb-2">Welcome back</h1>
            <p className="text-lg text-gray-600 mb-6">Your learning journey continues. Keep pushing boundaries.</p>
          </motion.div>

          <div className="grid grid-cols-3 gap-6 mt-8">
            {[
              { label: "Learning Streak", value: stats ? `${stats.streak_days} day${stats.streak_days === 1 ? "" : "s"}` : "—", icon: "🔥", color: "from-orange-500 to-red-500" },
              { label: "Weekly Hours", value: stats ? `${stats.weekly_hours} hrs` : "—", icon: "⏱️", color: "from-blue-500 to-cyan-500" },
              { label: "Total Lectures", value: stats ? String(stats.total_lectures) : "—", icon: "📈", color: "from-green-500 to-emerald-500" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
              >
                <div className="p-5 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/40 hover:border-white/60 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">{stat.icon}</span>
                    <span className="text-sm font-medium text-gray-600">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-display text-gray-900">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="px-8 py-12 max-w-6xl mx-auto space-y-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}>
          <h2 className="text-2xl font-display text-gray-900 mb-6">Your Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Lectures Processed", value: stats ? String(stats.total_lectures) : "—", icon: <Map size={18} />, color: "#6366f1" },
              { label: "Nodes Extracted",     value: stats ? String(stats.total_nodes) : "—",    icon: <Layers size={18} />, color: "#8b5cf6" },
              { label: "Hours Processed",     value: stats ? String(stats.total_hours) : "—",     icon: <Clock size={18} />, color: "#06b6d4" },
              { label: "Day Streak",          value: stats ? String(stats.streak_days) : "—",     icon: <TrendingUp size={18} />, color: "#10b981" },
            ].map((s, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 24, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="group relative"
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
                  style={{
                    background: `linear-gradient(135deg, ${s.color}15, ${s.color}05)`,
                    filter: "blur(20px)"
                  }} />
                
                <div className="relative p-6 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/40 group-hover:border-white/60 transition-all duration-300 h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl backdrop-blur-sm transition-all group-hover:scale-110 duration-300" 
                      style={{ 
                        background: `linear-gradient(135deg, ${s.color}20, ${s.color}10)`
                      }}>
                      <span style={{ color: s.color }} className="block">{s.icon}</span>
                    </div>
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <TrendingUp size={14} className="text-emerald-500" />
                    </motion.div>
                  </div>
                  <p className="text-3xl font-display text-gray-900 mb-2">{s.value}</p>
                  <p className="text-sm text-gray-600 font-medium uppercase tracking-wide">{s.label}</p>
                  
                  <div className="mt-4 h-1 rounded-full bg-white/20 overflow-hidden">
                    <motion.div 
                      className="h-full rounded-full" 
                      style={{ background: s.color }}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ delay: 0.6 + i * 0.1, duration: 0.8 }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}>
          <h2 className="text-2xl font-display text-gray-900 mb-6">Quick Actions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.button 
              onClick={() => onNavigate("live")}
              className="relative group h-40 overflow-hidden rounded-2xl border border-white/40 transition-all duration-300 hover:border-white/60"
              whileHover={{ scale: 1.02 }}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <div className="absolute inset-0" style={{
                background: "linear-gradient(135deg, rgba(109,94,247,0.12) 0%, rgba(109,94,247,0.04) 100%)"
              }} />
              
              <motion.div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: "linear-gradient(135deg, rgba(109,94,247,0.2) 0%, rgba(109,94,247,0.08) 100%)"
                }}
              />
              
              <div className="relative h-full flex items-center gap-6 px-8">
                <motion.div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm"
                  style={{ background: "rgba(109,94,247,0.15)", border: "1px solid rgba(109,94,247,0.3)" }}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <Mic size={28} className="text-purple-600" />
                </motion.div>
                
                <div className="text-left flex-1">
                  <p className="text-lg font-display text-gray-900 mb-1">Start Recording</p>
                  <p className="text-gray-600">Record and analyze in real-time</p>
                </div>
                
                <motion.div 
                  className="ml-2"
                  animate={{ x: [0, 6, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <ArrowRight size={20} className="text-gray-400 group-hover:text-purple-600 transition-colors" />
                </motion.div>
              </div>
            </motion.button>

            <motion.button 
              onClick={() => onNavigate("upload")}
              className="relative group h-40 overflow-hidden rounded-2xl border border-white/40 transition-all duration-300 hover:border-white/60"
              whileHover={{ scale: 1.02 }}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <div className="absolute inset-0" style={{
                background: "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.04) 100%)"
              }} />
              
              <motion.div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: "linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(124,58,237,0.08) 100%)"
                }}
              />
              
              <div className="relative h-full flex items-center gap-6 px-8">
                <motion.div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm"
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}
                  whileHover={{ scale: 1.1, rotate: -5 }}
                >
                  <Upload size={28} className="text-violet-600" />
                </motion.div>
                
                <div className="text-left flex-1">
                  <p className="text-lg font-display text-gray-900 mb-1">Upload Video</p>
                  <p className="text-gray-600">Process recorded lectures</p>
                </div>
                
                <motion.div 
                  className="ml-2"
                  animate={{ x: [0, 6, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <ArrowRight size={20} className="text-gray-400 group-hover:text-violet-600 transition-colors" />
                </motion.div>
              </div>
            </motion.button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.6 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-display text-gray-900">Recent Lectures</h2>
              <p className="text-gray-600 mt-1">Continue where you left off</p>
            </div>
            {recent.length > 0 && (
              <motion.button
                onClick={() => onNavigate("lectures")}
                className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors px-4 py-2 rounded-lg hover:bg-purple-50"
                whileHover={{ scale: 1.05 }}
              >
                View all →
              </motion.button>
            )}
          </div>

          {error && (
            <div className="p-6 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {!error && loading && (
            <div className="p-12 rounded-2xl border border-white/40 bg-white/50 text-center text-gray-500 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading your lectures...
            </div>
          )}

          {!error && !loading && recent.length === 0 && (
            <div className="p-12 rounded-2xl border border-dashed border-gray-300 bg-white/50 text-center">
              <Inbox size={32} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-700 font-medium mb-1">No lectures yet</p>
              <p className="text-gray-500 text-sm mb-4">Upload a recording or start a live session to build your first mind map.</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => onNavigate("upload")} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "linear-gradient(135deg, #6D5EF7, #7C3AED)" }}>Upload a lecture</button>
                <button onClick={() => onNavigate("live")} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-200">Record live</button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {recent.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.08, duration: 0.5 }}
                whileHover={{ scale: 1.01, x: 4 }}
              >
                <button
                  onClick={() => onOpenLecture(l.id)}
                  className="w-full group relative overflow-hidden rounded-2xl border border-white/40 hover:border-white/60 transition-all duration-300 p-6"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%)"
                  }}
                >
                  <div className="relative flex items-center gap-6">
                    <motion.div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm transition-all group-hover:scale-110"
                      style={{
                        background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.08))",
                        border: "1.5px solid rgba(99,102,241,0.4)"
                      }}
                    >
                      <Map size={28} className="text-indigo-600" />
                    </motion.div>

                    <div className="flex-1 min-w-0 text-left">
                      <h3 className="text-lg font-display text-gray-900 mb-2 truncate group-hover:text-purple-600 transition-colors">{l.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={14} />
                          {formatRelativeDate(l.created_at)}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Layers size={14} />
                          {l.node_count} nodes
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <BookOpen size={14} />
                          {formatDuration(l.duration_seconds)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}


function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/webm",
    "audio/mp4",
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type));
}

function LivePage({ onImport }: { onImport: (lecture: ActiveLecture) => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Live Session");
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<MindNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<MindNode | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showStudy, setShowStudy] = useState(false);
  const [filter, setFilter] = useState<NodeType | "all">("all");

  const { autoCenter, notifications } = useSettings();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const elapsedRef = useRef(0);
  const mapRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed(e => { const next = e + 1; elapsedRef.current = next; return next; }), 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => {
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const startRecording = async () => {
    setError(null);
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      chunksRef.current = [];
      const mimeType = pickAudioMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(mic, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 128000 });
      } catch {
        recorder = new MediaRecorder(mic);
      }
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => { void processRecording(); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setStream(mic);
      setElapsed(0);
      elapsedRef.current = 0;
      setRecording(true);
      setNodes([]);
      setEdges([]);
      setLectureId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access was denied.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setRecording(false);
  };

  const processRecording = async () => {
    const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    if (blob.size === 0) {
      setError("No audio was captured — check your microphone and try again.");
      return;
    }
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `live-recording.${ext}`, { type: mimeType });

    setProcessing(true);
    setError(null);
    try {
      const data = await processLectureAudio(file, elapsedRef.current);
      const graph = lectureJsonToGraph(data);
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setTitle(data.lecture_title);
      setLectureId(data.id);
      onImport({ id: data.id, title: data.lecture_title, nodes: graph.nodes, edges: graph.edges });
      if (notifications) toast.success(`"${data.lecture_title}" is ready`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setProcessing(false);
    }
  };

  const toggleBookmark = async (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const nextBookmarked = !node.bookmarked;
    setNodes(prev => prev.map(n => n.id === id ? { ...n, bookmarked: nextBookmarked } : n));
    if (lectureId) {
      try { await updateNode(lectureId, id, { bookmarked: nextBookmarked }); } catch { }
    }
  };

  const saveNotes = async (id: string, notes: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, notes } : n));
    if (lectureId) await updateNode(lectureId, id, { notes });
  };

  const visibleNodes = nodes.filter(n => filter === "all" || n.type === filter);

  return (
    <div className="flex-1 flex overflow-hidden relative">
      <div className="w-72 flex-shrink-0 border-r border-white/6 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/6">
          <div className="flex items-center gap-2 mb-4">
            <motion.div className="w-2 h-2 rounded-full" style={{ background: recording ? "#ef4444" : "#71717a" }}
              animate={recording ? { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] } : {}} transition={{ repeat: Infinity, duration: 1.2 }} />
            <span className="text-xs font-medium text-zinc-300">{recording ? "Recording" : processing ? "Processing" : "Ready"}</span>
            <span className="ml-auto font-mono text-sm text-white">{fmt(elapsed)}</span>
          </div>
          <Waveform stream={stream} active={recording} />
          <div className="flex gap-2 mt-4">
            <motion.button
              onClick={recording ? stopRecording : startRecording}
              disabled={processing}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-60"
              style={{ background: recording ? "rgba(239,68,68,0.2)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", border: recording ? "1px solid rgba(239,68,68,0.4)" : "none" }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              {recording ? <Square size={14} /> : <Mic size={14} />}
              {recording ? "Stop" : "Record"}
            </motion.button>
          </div>
          {error && (
            <p className="mt-3 text-xs text-red-400 flex items-start gap-1.5"><AlertCircle size={12} className="mt-0.5 flex-shrink-0" /> {error}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {processing && (
            <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-center gap-2.5">
              <Loader2 size={14} className="text-indigo-400 animate-spin" />
              <span className="text-xs text-indigo-300">Transcribing and structuring your recording...</span>
            </div>
          )}
          {!processing && nodes.length === 0 && (
            <div className="p-4 rounded-xl border border-dashed border-white/10 text-center">
              <p className="text-xs text-zinc-500">Hit Record to capture a lecture. When you stop, it's transcribed and turned into a mind map here.</p>
            </div>
          )}
          {nodes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">{title}</p>
              <p className="text-xs text-zinc-400">{nodes.length} nodes extracted</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        <MiniMindMap
          ref={mapRef}
          nodes={visibleNodes}
          edges={edges}
          selectedId={selectedNode?.id ?? null}
          onNodeClick={n => setSelectedNode(prev => prev?.id === n.id ? null : n)}
          newNodeId={null}
          autoCenter={autoCenter}
        />

        <div className="absolute top-3 left-3 flex gap-1.5">
          {(["all", "main", "subtopic", "note", "insight"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-all ${filter === f ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" : "bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white"}`}>
              {f}
            </button>
          ))}
        </div>

        {nodes.length > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {lectureId && (
              <button onClick={() => setShowStudy(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-zinc-900/80 backdrop-blur-md text-xs text-zinc-400 hover:text-white transition-all">
                <HelpCircle size={12} /> Study
              </button>
            )}
            <button onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-zinc-900/80 backdrop-blur-md text-xs text-zinc-400 hover:text-white transition-all">
              <Download size={12} /> Export
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedNode && (
          <div className="relative w-80 flex-shrink-0">
            <NodeSidebar
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onBookmark={toggleBookmark}
              onSaveNotes={saveNotes}
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExport && <ExportModal onClose={() => setShowExport(false)} title={title} nodes={nodes} edges={edges} svgRef={mapRef} />}
      </AnimatePresence>

      <AnimatePresence>
        {showStudy && lectureId && <StudyModal onClose={() => setShowStudy(false)} lectureId={lectureId} lectureTitle={title} />}
      </AnimatePresence>
    </div>
  );
}


function getMediaDuration(file: File): Promise<number | undefined> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const media = document.createElement(file.type.startsWith("video") ? "video" : "audio");
    const cleanup = () => URL.revokeObjectURL(url);
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      const duration = Number.isFinite(media.duration) ? media.duration : undefined;
      cleanup();
      resolve(duration);
    };
    media.onerror = () => { cleanup(); resolve(undefined); };
    media.src = url;
  });
}

function UploadPage({ onImport, onNavigate }: { onImport: (lecture: ActiveLecture) => void; onNavigate: (p: Page) => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pendingGraph, setPendingGraph] = useState<{ nodes: AppMindNode[]; edges: AppEdge[] } | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");
  const [pendingLectureId, setPendingLectureId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isTextSource, setIsTextSource] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadRealFile(file);
  };

  const simulateUpload = (name: string) => {
    setUploaded(name);
    setProcessing(true);
    setProgress(0);
    setUploadError(null);
    const t = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(t); setProcessing(false); return 100; }
        return p + 2;
      });
    }, 80);
  };

  const uploadRealFile = async (file: File) => {
    setIsTextSource(false);
    setUploaded(file.name);
    setProcessing(true);
    setProgress(0);
    setPendingGraph(null);
    setPendingLectureId(null);
    setUploadError(null);

    const t = setInterval(() => {
      setProgress(p => (p < 90 ? p + 2 : p));
    }, 200);

    try {
      const duration = await getMediaDuration(file);
      const data = await processLectureAudio(file, duration);
      const graph = lectureJsonToGraph(data);
      setPendingGraph(graph);
      setPendingTitle(data.lecture_title || file.name);
      setPendingLectureId(data.id);
      setProgress(100);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      clearInterval(t);
      setProcessing(false);
    }
  };

  const loadSample = () => {
    setIsTextSource(false);
    const graph = lectureJsonToGraph(CARS_LECTURE);
    setPendingGraph(graph);
    setPendingTitle(CARS_LECTURE.lecture_title);
    setPendingLectureId(null);
    simulateUpload("understanding_cars_lecture.mp3");
  };

  const applyPastedTranscript = async () => {
    const transcript = pasteValue.trim();
    if (transcript.length < 30) {
      setPasteError("Paste a longer transcript (at least a few sentences) so there's enough to work with.");
      return;
    }
    setPasteError(null);
    setShowPaste(false);
    setIsTextSource(true);
    setUploaded("Pasted transcript");
    setProcessing(true);
    setProgress(0);
    setPendingGraph(null);
    setPendingLectureId(null);
    setUploadError(null);

    const t = setInterval(() => {
      setProgress(p => (p < 90 ? p + 2 : p));
    }, 200);

    try {
      const data = await processLectureText(transcript);
      const graph = lectureJsonToGraph(data);
      setPendingGraph(graph);
      setPendingTitle(data.lecture_title || "Imported lecture");
      setPendingLectureId(data.id);
      setProgress(100);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't process that transcript");
    } finally {
      clearInterval(t);
      setProcessing(false);
    }
  };

  const handleOpenMindMap = () => {
    if (pendingGraph) onImport({ id: pendingLectureId, title: pendingTitle, nodes: pendingGraph.nodes, edges: pendingGraph.edges });
    onNavigate("mindmap");
  };

  const steps = [
    { label: isTextSource ? "Reading transcript" : "Transcribing audio", done: progress > 30 },
    { label: "Extracting concepts",     done: progress > 55 },
    { label: "Building hierarchy",      done: progress > 75 },
    { label: "Generating mind map",     done: progress > 90 },
    { label: "Ready",                   done: progress >= 100 },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <motion.div 
        className="relative px-8 pt-12 pb-8 bg-gradient-to-br from-purple-50/50 to-blue-50/30 border-b border-white/20"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <h1 className="text-4xl font-display text-gray-900 mb-2">Upload Your Lecture</h1>
            <p className="text-lg text-gray-600">Convert video into structured knowledge. Support for MP4, MOV, MPEG, MP3, WAV, M4A up to 500MB.</p>
          </motion.div>
        </div>
      </motion.div>

      <div className="px-8 py-12 max-w-4xl mx-auto">
        {!uploaded ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-8"
          >
            <motion.div
              className={`relative rounded-3xl border-2 border-dashed overflow-hidden transition-all cursor-pointer ${
                dragging 
                  ? "border-purple-400 bg-purple-50" 
                  : "border-gray-300 hover:border-gray-400 bg-white/50 hover:bg-white/70"
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.01 }}
              animate={dragging ? { scale: 1.02 } : { scale: 1 }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={e => { const file = e.target.files?.[0]; if (file) uploadRealFile(file); e.target.value = ""; }}
              />
              <motion.div 
                className="absolute inset-0 opacity-0 transition-opacity"
                style={{
                  background: "linear-gradient(135deg, rgba(109,94,247,0.05), rgba(124,58,237,0.05))"
                }}
                animate={dragging ? { opacity: 1 } : { opacity: 0 }}
              />

              <div className="relative py-20 px-8 text-center">
                <motion.div 
                  className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(109,94,247,0.15), rgba(124,58,237,0.1))" }}
                  animate={dragging ? { scale: 1.2, rotate: 5 } : { scale: 1, rotate: 0 }}
                >
                  <Upload size={40} className="text-purple-600" />
                </motion.div>

                <p className="text-2xl font-display text-gray-900 mb-3">Drop your lecture here</p>
                <p className="text-gray-600 mb-6">or click to browse your computer</p>

                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {["MP4", "MOV", "MPEG", "MP3", "WAV", "M4A"].map((f, i) => (
                    <motion.span 
                      key={f} 
                      className="px-3 py-1.5 rounded-full bg-gray-100 text-sm font-medium text-gray-700 border border-gray-200"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                    >
                      {f}
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm text-gray-500 font-medium">OR</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.button 
                onClick={loadSample}
                className="group relative overflow-hidden rounded-2xl border border-gray-200 hover:border-gray-300 transition-all p-6 bg-white/70 hover:bg-white/90"
                whileHover={{ y: -2 }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={20} className="text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-display text-gray-900 mb-1">Try Sample Lecture</p>
                    <p className="text-sm text-gray-600">Load our demo on automotive design</p>
                  </div>
                </div>
              </motion.button>

              <motion.button 
                onClick={() => setShowPaste(v => !v)}
                className="group relative overflow-hidden rounded-2xl border border-gray-200 hover:border-gray-300 transition-all p-6 bg-white/70 hover:bg-white/90"
                whileHover={{ y: -2 }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center flex-shrink-0">
                    <FileText size={20} className="text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-display text-gray-900 mb-1">Paste Transcript</p>
                    <p className="text-sm text-gray-600">Paste text from a video's transcript</p>
                  </div>
                </div>
              </motion.button>
            </div>

            {showPaste && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur-sm p-6"
              >
                <p className="text-sm text-gray-600 mb-3">Paste the transcript text from a video or lecture recording, and we'll extract topics, build the hierarchy, and generate the mind map.</p>
                <textarea
                  value={pasteValue}
                  onChange={e => setPasteValue(e.target.value)}
                  className="w-full h-40 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 p-4 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 resize-none"
                  placeholder="Paste the video or lecture transcript here..."
                />
                {pasteError && <p className="text-sm text-red-600 mt-3 font-medium">{pasteError}</p>}
                <motion.button
                  onClick={applyPastedTranscript}
                  className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #6D5EF7, #7C3AED)" }}
                  whileHover={{ scale: 1.02, boxShadow: "0 10px 30px rgba(109,94,247,0.2)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  Generate Mind Map
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur-sm p-8">
              <div className="flex items-start gap-6 mb-6">
                <motion.div 
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center flex-shrink-0"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <FileText size={28} className="text-purple-600" />
                </motion.div>
                <div>
                  <p className="font-display text-lg text-gray-900">{uploaded}</p>
                  <p className="text-sm text-gray-600 mt-1">{progress}% complete</p>
                </div>
              </div>

              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <motion.div 
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #6D5EF7, #7C3AED)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {uploadError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-red-200 bg-red-50 p-6 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="font-display text-red-900 mb-1">Processing failed</p>
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
                <button
                  onClick={() => { setUploaded(null); setUploadError(null); setProgress(0); }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-red-700 border border-red-300 hover:bg-red-100 transition-all flex-shrink-0"
                >
                  Try again
                </button>
              </motion.div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur-sm p-8">
              <h3 className="font-display text-lg text-gray-900 mb-6">Processing your lecture</h3>
              <div className="space-y-4">
                {steps.map((s, i) => (
                  <motion.div 
                    key={i}
                    className="flex items-center gap-4"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <motion.div 
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        s.done 
                          ? "bg-green-100" 
                          : "bg-gray-100"
                      }`}
                      animate={processing && !s.done && steps.indexOf(s) === steps.findIndex(x => !x.done) ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      {s.done ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                      )}
                    </motion.div>
                    <span className={`text-sm font-medium ${s.done ? "text-gray-900" : "text-gray-600"}`}>
                      {s.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {progress === 100 && !uploadError && (
              <motion.button 
                onClick={handleOpenMindMap}
                className="w-full py-4 rounded-2xl text-lg font-display text-white transition-all"
                style={{ background: "linear-gradient(135deg, #6D5EF7, #7C3AED)" }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(109,94,247,0.2)" }}
                whileTap={{ scale: 0.98 }}
              >
                View Mind Map →
              </motion.button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}


function MindMapPage({ lectureId, title, nodes: sourceNodes, edges: sourceEdges, initialSelectedNodeId }: {
  lectureId: string | null;
  title: string;
  nodes: MindNode[];
  edges: Edge[];
  initialSelectedNodeId?: string | null;
}) {
  const [nodes, setNodes] = useState<MindNode[]>(sourceNodes);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedNodeId ?? null);
  const [showExport, setShowExport] = useState(false);
  const [showStudy, setShowStudy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NodeType | "all">("all");
  const { autoCenter } = useSettings();
  const mapRef = useRef<SVGSVGElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setNodes(sourceNodes); }, [sourceNodes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") { e.preventDefault(); searchRef.current?.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") { e.preventDefault(); setShowExport(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleBookmark = async (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const nextBookmarked = !node.bookmarked;
    setNodes(prev => prev.map(n => n.id === id ? { ...n, bookmarked: nextBookmarked } : n));
    if (lectureId) {
      try { await updateNode(lectureId, id, { bookmarked: nextBookmarked }); } catch { }
    }
  };

  const saveNotes = async (id: string, notes: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, notes } : n));
    if (lectureId) await updateNode(lectureId, id, { notes });
  };

  const visibleNodes = nodes.filter(n => {
    if (filter !== "all" && n.type !== filter) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedNode = selectedId ? nodes.find(n => n.id === selectedId) ?? null : null;

  return (
    <div className="flex-1 flex overflow-hidden relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/6">
          <div className="flex items-center gap-1.5 flex-1">
            <Search size={13} className="text-zinc-500" />
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-zinc-300 placeholder-zinc-600 outline-none"
              placeholder="Search nodes..." />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-zinc-500" />
            {(["all", "main", "subtopic", "note", "insight", "definition", "example", "question", "important"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-all ${filter === f ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40" : "text-zinc-500 hover:text-zinc-300"}`}>
                {f}
              </button>
            ))}
          </div>
          {lectureId && (
            <button onClick={() => setShowStudy(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-zinc-400 hover:text-white transition-all">
              <HelpCircle size={12} /> Study
            </button>
          )}
          <button onClick={() => setShowExport(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-zinc-400 hover:text-white transition-all">
            <Download size={12} /> Export
          </button>
        </div>

        <div className="flex-1 relative">
          <MiniMindMap
            ref={mapRef}
            nodes={visibleNodes}
            edges={sourceEdges}
            selectedId={selectedId}
            onNodeClick={n => setSelectedId(prev => prev === n.id ? null : n.id)}
            newNodeId={null}
            autoCenter={autoCenter}
          />
        </div>
      </div>

      <AnimatePresence>
        {selectedNode && (
          <div className="relative w-80 flex-shrink-0 border-l border-white/6">
            <NodeSidebar
              node={selectedNode}
              onClose={() => setSelectedId(null)}
              onBookmark={toggleBookmark}
              onSaveNotes={saveNotes}
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExport && <ExportModal onClose={() => setShowExport(false)} title={title} nodes={nodes} edges={sourceEdges} svgRef={mapRef} />}
      </AnimatePresence>

      <AnimatePresence>
        {showStudy && lectureId && <StudyModal onClose={() => setShowStudy(false)} lectureId={lectureId} lectureTitle={title} />}
      </AnimatePresence>
    </div>
  );
}


function LecturesPage({ onOpenLecture, onNavigate }: { onOpenLecture: (id: string) => void; onNavigate: (p: Page) => void }) {
  const [lectures, setLectures] = useState<LectureSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    listLectures()
      .then(setLectures)
      .catch(err => setError(err instanceof Error ? err.message : "Couldn't load your lectures."));
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteLecture(id);
      setLectures(prev => (prev ?? []).filter(l => l.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this lecture.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-display text-gray-900 mb-1">My Lectures</h2>
          <p className="text-gray-600 text-sm">Every lecture you've processed, saved locally on this device.</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {!error && lectures === null && (
          <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        )}

        {!error && lectures !== null && lectures.length === 0 && (
          <div className="p-12 rounded-2xl border border-dashed border-gray-300 bg-white/50 text-center">
            <Inbox size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-700 font-medium mb-1">No lectures yet</p>
            <p className="text-gray-500 text-sm mb-4">Upload a recording or start a live session to build your first mind map.</p>
            <button onClick={() => onNavigate("upload")} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "linear-gradient(135deg, #6D5EF7, #7C3AED)" }}>
              Upload a lecture
            </button>
          </div>
        )}

        <div className="space-y-3">
          {(lectures ?? []).map(l => (
            <div key={l.id} className="flex items-center gap-4 p-5 rounded-2xl border border-white/40 bg-white/70 hover:border-white/60 transition-all">
              <button onClick={() => onOpenLecture(l.id)} className="flex-1 flex items-center gap-4 text-left min-w-0">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(99,102,241,0.15)", border: "1.5px solid rgba(99,102,241,0.3)" }}>
                  <Map size={22} className="text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-gray-900 truncate">{l.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatRelativeDate(l.created_at)} · {l.node_count} nodes · {formatDuration(l.duration_seconds)}</p>
                </div>
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={deletingId === l.id}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0 disabled:opacity-50">
                    {deletingId === l.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{l.title}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the lecture, its mind map, and any notes or bookmarks on it. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(l.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nodeColors = useNodeColors();

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(err => setError(err instanceof Error ? err.message : "Couldn't load analytics."));
  }, []);

  if (error) {
    return (
      <div className="flex-1 p-8">
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading analytics...
      </div>
    );
  }

  const hasData = stats.total_lectures > 0;
  const typeBreakdown = [...stats.node_type_breakdown].sort((a, b) => b.count - a.count);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-display text-gray-900 mb-1">Analytics</h2>
          <p className="text-gray-600 text-sm">Real usage stats, computed from your saved lectures.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Lectures", value: stats.total_lectures },
            { label: "Nodes", value: stats.total_nodes },
            { label: "Hours Processed", value: stats.total_hours },
            { label: "Day Streak", value: stats.streak_days },
          ].map((s, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white/70 border border-white/40">
              <p className="text-2xl font-display text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {!hasData ? (
          <div className="p-12 rounded-2xl border border-dashed border-gray-300 bg-white/50 text-center">
            <BarChart3 size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-700 font-medium">No data yet</p>
            <p className="text-gray-500 text-sm">Process a lecture to see charts here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white/70 border border-white/40">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Lectures processed (last 14 days)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.lectures_per_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={24} />
                  <RTooltip cursor={{ fill: "rgba(99,102,241,0.06)" }} />
                  <Bar dataKey="count" name="Lectures" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-6 rounded-2xl bg-white/70 border border-white/40">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Node types extracted</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={typeBreakdown} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="type" width={80} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <RTooltip cursor={{ fill: "rgba(99,102,241,0.06)" }} />
                  <Bar dataKey="count" name="Nodes" radius={[0, 4, 4, 0]}>
                    {typeBreakdown.map(entry => (
                      <Cell key={entry.type} fill={nodeColors[entry.type as NodeType]?.border ?? "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function BookmarksPage({ onOpenBookmark }: { onOpenBookmark: (lectureId: string, nodeId: string) => void }) {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBookmarks()
      .then(setBookmarks)
      .catch(err => setError(err instanceof Error ? err.message : "Couldn't load bookmarks."));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-display text-gray-900 mb-1">Bookmarks</h2>
          <p className="text-gray-600 text-sm">Nodes you've starred, across every lecture.</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {!error && bookmarks === null && (
          <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        )}

        {!error && bookmarks !== null && bookmarks.length === 0 && (
          <div className="p-12 rounded-2xl border border-dashed border-gray-300 bg-white/50 text-center">
            <Bookmark size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-700 font-medium mb-1">No bookmarks yet</p>
            <p className="text-gray-500 text-sm">Open a node in a mind map and tap the bookmark icon to save it here.</p>
          </div>
        )}

        <div className="space-y-3">
          {(bookmarks ?? []).map(b => (
            <button
              key={`${b.lecture_id}-${b.node_id}`}
              onClick={() => onOpenBookmark(b.lecture_id, b.node_id)}
              className="w-full flex items-start gap-4 p-5 rounded-2xl border border-white/40 bg-white/70 hover:border-white/60 transition-all text-left">
              <div className="mt-0.5"><Badge type={typeToAppType(b.type)} /></div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-gray-900 truncate">{b.label}</p>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{b.summary}</p>
                <p className="text-xs text-gray-400 mt-2">from "{b.lecture_title}"</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


function SettingsPage() {
  const { largeText, highContrast, reducedMotion, colorblindMode, autoCenter, notifications, setSetting } = useSettings();

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange} className={`relative w-9 h-5 rounded-full transition-all ${value ? "bg-indigo-500" : "bg-white/10"}`}
      role="switch" aria-checked={value}>
      <motion.div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
        animate={{ left: value ? "calc(100% - 1.125rem)" : "0.125rem" }} transition={{ type: "spring", damping: 20, stiffness: 300 }} />
    </button>
  );

  const sections = [
    {
      title: "Accessibility",
      settings: [
        { label: "Large text mode",           desc: "Increase base font size for easier reading",         value: largeText,      onChange: () => setSetting("largeText", !largeText) },
        { label: "High contrast mode",         desc: "Stronger color contrast for low-vision users",       value: highContrast,   onChange: () => setSetting("highContrast", !highContrast) },
        { label: "Reduced motion",             desc: "Minimize animations for motion-sensitive users",     value: reducedMotion,  onChange: () => setSetting("reducedMotion", !reducedMotion) },
        { label: "Colorblind-friendly palette",desc: "Use an accessible, CVD-validated color scheme for all node types", value: colorblindMode, onChange: () => setSetting("colorblindMode", !colorblindMode) },
      ],
    },
    {
      title: "Mind Map",
      settings: [
        { label: "Auto-center on new node", desc: "Automatically pan to newly added nodes",    value: autoCenter,     onChange: () => setSetting("autoCenter", !autoCenter) },
        { label: "Notifications",           desc: "Show a toast when processing finishes",     value: notifications,  onChange: () => setSetting("notifications", !notifications) },
      ],
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
          <p className="text-zinc-400 text-sm">Customize LectureLens to your needs.</p>
        </div>

        {sections.map((section, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{section.title}</p>
            <GlassCard>
              <div className="divide-y divide-white/6">
                {section.settings.map((s, j) => (
                  <div key={j} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-white">{s.label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{s.desc}</p>
                    </div>
                    <Toggle value={s.value} onChange={s.onChange} />
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        ))}

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Keyboard Shortcuts</p>
          <GlassCard>
            <div className="divide-y divide-white/6">
              {[
                { action: "Command palette",  keys: ["⌘", "K"] },
                { action: "Search nodes (on Mind Map)", keys: ["⌘", "F"] },
                { action: "Export map (on Mind Map)",   keys: ["⌘", "E"] },
                { action: "Focus mode",       keys: ["⌘", "⇧", "F"] },
              ].map((s, j) => (
                <div key={j} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-zinc-300">{s.action}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, ki) => (
                      <kbd key={ki} className="px-2 py-0.5 rounded border border-white/12 bg-white/5 text-xs text-zinc-400 font-mono">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}


export default function App() {
  return (
    <SettingsProvider>
      <AppShell />
    </SettingsProvider>
  );
}

function AppShell() {
  const [page, setPage] = useState<Page>("landing");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [activeLecture, setActiveLecture] = useState<ActiveLecture>({
    id: null, title: "Machine Learning Fundamentals", nodes: SEED_NODES, edges: SEED_EDGES,
  });
  const [pendingSelectNodeId, setPendingSelectNodeId] = useState<string | null>(null);
  const { reducedMotion } = useSettings();

  const handleImport = (lecture: ActiveLecture) => {
    setActiveLecture(lecture);
    setPendingSelectNodeId(null);
  };

  const openLecture = async (id: string) => {
    try {
      const detail = await getLecture(id);
      const graph = lectureJsonToGraph(detail);
      setActiveLecture({ id: detail.id, title: detail.lecture_title, nodes: graph.nodes, edges: graph.edges });
      setPendingSelectNodeId(null);
      setPage("mindmap");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open that lecture.");
    }
  };

  const openBookmark = async (lectureId: string, nodeId: string) => {
    try {
      const detail = await getLecture(lectureId);
      const graph = lectureJsonToGraph(detail);
      setActiveLecture({ id: detail.id, title: detail.lecture_title, nodes: graph.nodes, edges: graph.edges });
      setPendingSelectNodeId(nodeId);
      setPage("mindmap");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open that bookmark.");
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette(p => !p);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFocusMode(f => !f);
      }
      if (e.key === "Escape") setShowCommandPalette(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const pageTitle: Record<Page, string> = {
    landing:   "LectureLens",
    dashboard: "Dashboard",
    live:      "Live Lecture",
    upload:    "Upload Video",
    mindmap:   activeLecture.title,
    settings:  "Settings",
    lectures:  "My Lectures",
    analytics: "Analytics",
    bookmarks: "Bookmarks",
  };

  if (page === "landing") {
    return (
      <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
        <div className="dark min-h-screen bg-background text-foreground">
          <Toaster position="top-right" richColors />
          <AnimatePresence>
            {showCommandPalette && (
              <CommandPalette
                onClose={() => setShowCommandPalette(false)}
                onNavigate={p => { setPage(p); setShowCommandPalette(false); }}
                onToggleFocusMode={() => { setFocusMode(f => !f); setShowCommandPalette(false); }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <LandingPage onNavigate={setPage} />
            </motion.div>
          </AnimatePresence>
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
      <div className="dark h-screen bg-background text-foreground flex overflow-hidden">
        <Toaster position="top-right" richColors />
        <AnimatePresence>
          {showCommandPalette && (
            <CommandPalette
              onClose={() => setShowCommandPalette(false)}
              onNavigate={p => { setPage(p); setShowCommandPalette(false); }}
              onToggleFocusMode={() => { setFocusMode(f => !f); setShowCommandPalette(false); }}
            />
          )}
        </AnimatePresence>

        {!focusMode && <AppSidebar page={page} onNavigate={setPage} />}

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {!focusMode && <TopBar title={pageTitle[page]} onCommandPalette={() => setShowCommandPalette(true)} />}
          {focusMode && (
            <button
              onClick={() => setFocusMode(false)}
              className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-zinc-900/80 backdrop-blur-md text-xs text-zinc-300 hover:text-white transition-all">
              <Minimize2 size={12} /> Exit focus mode
            </button>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={page} className="flex-1 flex overflow-hidden"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              {page === "dashboard" && <Dashboard onNavigate={setPage} onCommandPalette={() => setShowCommandPalette(true)} onOpenLecture={openLecture} />}
              {page === "live"      && <LivePage onImport={handleImport} />}
              {page === "upload"    && <UploadPage onImport={handleImport} onNavigate={setPage} />}
              {page === "mindmap"   && <MindMapPage lectureId={activeLecture.id} title={activeLecture.title} nodes={activeLecture.nodes} edges={activeLecture.edges} initialSelectedNodeId={pendingSelectNodeId} />}
              {page === "lectures"  && <LecturesPage onOpenLecture={openLecture} onNavigate={setPage} />}
              {page === "analytics" && <AnalyticsPage />}
              {page === "bookmarks" && <BookmarksPage onOpenBookmark={openBookmark} />}
              {page === "settings"  && <SettingsPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}
