"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Clock,
  Target,
  Lightbulb,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Lock,
  Code2,
  Layers,
  Wrench,
  Box,
  LayoutGrid,
  Library,
  X,
  Zap,
  List,
  Network,
  ArrowRight as ArrowRightIcon,
} from "lucide-react";
import type {
  LearningPath,
  LearningPathV1,
  LearningPathV2,
  SkillNode,
  SkillEdge,
  PlatformRecommendation,
  SkillModule,
} from "@/types/learning";
import { isV2LearningPath } from "@/types/learning";

interface LearningPathTabProps {
  learningPath: LearningPath | null | undefined;
}

// ─── Constants ────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  language: Code2,
  framework: Layers,
  pattern: LayoutGrid,
  tooling: Wrench,
  architecture: Box,
  library: Library,
};

const PRICE_STYLES: Record<string, string> = {
  free: "bg-accent-green/10 text-accent-green border-accent-green/30",
  paid: "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30",
  subscription: "bg-secondary/10 text-secondary border-secondary/30",
};

const INTENT_LABELS: Record<
  string,
  { label: string; icon: typeof BookOpen }
> = {
  start_here: { label: "Start Here", icon: Sparkles },
  go_deeper: { label: "Go Deeper", icon: Target },
  quick_reference: { label: "Quick Reference", icon: BookOpen },
};

// ─── Main Export ──────────────────────────────────────────────────────

export function LearningPathTab({ learningPath }: LearningPathTabProps) {
  if (!learningPath) {
    return (
      <div className="text-center py-16">
        <GraduationCap size={48} className="mx-auto mb-4 text-muted" />
        <p className="text-lg font-bold text-muted">
          No learning path available.
        </p>
        <p className="text-sm text-muted mt-1">
          Run analysis to generate a personalized learning path.
        </p>
      </div>
    );
  }

  if (isV2LearningPath(learningPath)) {
    return <V2LearningPath path={learningPath} />;
  }

  return <V1LearningPath path={learningPath} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Topological sort into layers for tree visualization */
function computeLayers(
  nodes: SkillNode[],
  edges: SkillEdge[]
): string[][] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    dependents.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    dependents.get(edge.from)?.push(edge.to);
  }

  const layers: string[][] = [];
  let current = [...nodeIds].filter((id) => inDegree.get(id) === 0);

  while (current.length > 0) {
    layers.push(current);
    const next: string[] = [];
    for (const id of current) {
      for (const dep of dependents.get(id) || []) {
        const newDeg = (inDegree.get(dep) || 1) - 1;
        inDegree.set(dep, newDeg);
        if (newDeg === 0) next.push(dep);
      }
    }
    current = next;
  }

  // Handle remaining nodes (cycles or disconnected)
  const layered = new Set(layers.flat());
  const remaining = [...nodeIds].filter((id) => !layered.has(id));
  if (remaining.length > 0) layers.push(remaining);

  return layers;
}

// ─── Progress Ring ────────────────────────────────────────────────────

function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 3.5,
  color = "#10B981",
  textClass = "text-[10px] font-bold",
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  textClass?: string;
}) {
  const clamped = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        className="text-foreground/8"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className={cn("fill-foreground", textClass)}
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

// ─── V2 Learning Path ─────────────────────────────────────────────────

function V2LearningPath({ path }: { path: LearningPathV2 }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const detailRef = useRef<HTMLDivElement>(null);
  const [edgePaths, setEdgePaths] = useState<
    { from: string; to: string; d: string; color: string }[]
  >([]);

  const nodeMap = useMemo(
    () => new Map(path.nodes.map((n) => [n.id, n])),
    [path.nodes]
  );
  const moduleMap = useMemo(
    () => new Map(path.modules.map((m) => [m.id, m])),
    [path.modules]
  );
  const layers = useMemo(
    () => computeLayers(path.nodes, path.edges),
    [path.nodes, path.edges]
  );

  const isBeginner = path.skillLevel?.toLowerCase() === "beginner";

  // Edges connected to hovered/selected node
  const connectedEdges = useMemo(() => {
    const activeId = hoveredNode || selectedNode;
    if (!activeId) return new Set<string>();
    const connected = new Set<string>();
    for (const edge of path.edges) {
      if (edge.from === activeId || edge.to === activeId) {
        connected.add(`${edge.from}-${edge.to}`);
      }
    }
    return connected;
  }, [hoveredNode, selectedNode, path.edges]);

  // Connected node IDs (for dimming unrelated nodes)
  const connectedNodeIds = useMemo(() => {
    const activeId = hoveredNode || selectedNode;
    if (!activeId) return new Set<string>();
    const ids = new Set<string>([activeId]);
    for (const edge of path.edges) {
      if (edge.from === activeId) ids.add(edge.to);
      if (edge.to === activeId) ids.add(edge.from);
    }
    return ids;
  }, [hoveredNode, selectedNode, path.edges]);

  // Compute SVG edge paths after render
  const computeEdgePaths = useCallback(() => {
    if (!containerRef.current || path.edges.length === 0) {
      setEdgePaths([]);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const paths: { from: string; to: string; d: string; color: string }[] = [];

    for (const edge of path.edges) {
      const fromEl = nodeRefs.current.get(edge.from);
      const toEl = nodeRefs.current.get(edge.to);
      if (!fromEl || !toEl) continue;

      const fr = fromEl.getBoundingClientRect();
      const tr = toEl.getBoundingClientRect();

      // Horizontal: right-center of source → left-center of target
      const fx = fr.right - rect.left;
      const fy = fr.top + fr.height / 2 - rect.top;
      const tx = tr.left - rect.left;
      const ty = tr.top + tr.height / 2 - rect.top;

      const midX = (fx + tx) / 2;
      const d = `M${fx},${fy} C${midX},${fy} ${midX},${ty} ${tx},${ty}`;

      const toNode = nodeMap.get(edge.to);
      const mod = toNode ? moduleMap.get(toNode.moduleId) : null;
      paths.push({ from: edge.from, to: edge.to, d, color: mod?.color || "#6366f1" });
    }

    setEdgePaths(paths);
  }, [path.edges, nodeMap, moduleMap]);

  useEffect(() => {
    if (viewMode !== "tree") {
      nodeRefs.current.clear();
      return;
    }

    const timer = requestAnimationFrame(() => computeEdgePaths());

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(computeEdgePaths);
    });
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(timer);
      observer.disconnect();
    };
  }, [viewMode, computeEdgePaths, layers]);

  // Scroll detail panel into view when a node is selected
  useEffect(() => {
    if (selectedNode && detailRef.current) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 50);
    }
  }, [selectedNode]);

  const selectedNodeData = selectedNode ? nodeMap.get(selectedNode) : null;
  const overallProgress =
    path.totalConcepts > 0
      ? (path.completedConcepts / path.totalConcepts) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="flex items-center gap-2.5 text-2xl font-bold mb-3">
            <GraduationCap size={24} />
            Your Learning Path
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs px-2.5 py-1">
              {path.role.displayName}
            </Badge>
            <Badge variant="warning" className="capitalize text-xs px-2.5 py-1">
              {path.skillLevel}
            </Badge>
            <span className="text-sm text-muted font-medium">
              {path.totalConcepts} concepts
              {" · "}
              ~{Math.round(path.estimatedTotalMinutes / 60)}h total
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ProgressRing
            progress={overallProgress}
            size={50}
            strokeWidth={3.5}
            color="#10B981"
            textClass="text-[10px] font-bold"
          />
          <div className="flex border-2 border-foreground/12 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("tree")}
              className={cn(
                "p-2 transition-colors cursor-pointer",
                viewMode === "tree"
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground hover:bg-foreground/5"
              )}
              title="Skill tree view"
            >
              <Network size={15} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 transition-colors cursor-pointer",
                viewMode === "list"
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground hover:bg-foreground/5"
              )}
              title="List view"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Gap Analysis Banner ────────────────── */}
      {path.gapAnalysis && (
        <GapAnalysisBanner
          gapAnalysis={path.gapAnalysis}
          isBeginner={isBeginner}
        />
      )}

      {/* ─── Module Dashboard ───────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {path.modules.map((mod) => {
          const moduleNodes = mod.nodeIds
            .map((id) => nodeMap.get(id))
            .filter((n): n is SkillNode => !!n);
          const completed = moduleNodes.filter(
            (n) => n.status === "completed"
          ).length;
          const totalMin = moduleNodes.reduce(
            (s, n) => s + n.estimatedMinutes,
            0
          );

          return (
            <button
              key={mod.id}
              onClick={() => {
                const firstNode = mod.nodeIds[0];
                if (firstNode) {
                  setSelectedNode(firstNode);
                  if (viewMode === "list") setViewMode("tree");
                }
              }}
              className={cn(
                "text-left p-3.5 rounded-xl border-2 border-foreground/8",
                "hover:border-foreground/20 hover:shadow-[2px_2px_0px_0px] hover:shadow-foreground/8",
                "transition-all cursor-pointer group bg-surface"
              )}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: mod.color || "#6366f1" }}
                />
                <span className="text-[11px] text-muted font-medium">
                  {completed}/{moduleNodes.length}
                </span>
              </div>
              <p className="text-[13px] font-bold leading-snug group-hover:text-secondary transition-colors line-clamp-2">
                {mod.title}
              </p>
              <p className="text-[11px] text-muted font-medium mt-1.5 flex items-center gap-1">
                <Clock size={10} />
                {totalMin < 60
                  ? `${totalMin} min`
                  : `${Math.round(totalMin / 60)}h ${totalMin % 60}m`}
              </p>
            </button>
          );
        })}
      </div>

      {/* ─── Skill Tree View ────────────────────── */}
      {viewMode === "tree" && (
        <Card className="border-2 border-foreground/10">
          <CardContent className="p-4 sm:p-5">
            {/* Tree header + legend */}
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-secondary/10 rounded-lg">
                  <Network size={14} className="text-secondary" />
                </div>
                <p className="text-sm font-bold">Skill Tree</p>
                <span className="text-[11px] text-muted font-medium hidden sm:inline">
                  — click a concept to explore
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {path.modules.slice(0, 6).map((mod) => (
                  <div
                    key={mod.id}
                    className="flex items-center gap-1.5"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: mod.color || "#6366f1",
                      }}
                    />
                    <span className="text-[10px] font-medium text-muted whitespace-nowrap">
                      {mod.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Horizontal scrollable tree */}
            <div className="overflow-x-auto pb-2 -mx-1 px-1">
              <div ref={containerRef} className="relative inline-flex min-w-full justify-center">
                {/* SVG Edges */}
                {edgePaths.length > 0 && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ overflow: "visible", zIndex: 0 }}
                  >
                    <defs>
                      <marker
                        id="arrow"
                        markerWidth="7"
                        markerHeight="5"
                        refX="6"
                        refY="2.5"
                        orient="auto"
                      >
                        <polygon
                          points="0 0, 7 2.5, 0 5"
                          className="fill-foreground/15"
                        />
                      </marker>
                      <marker
                        id="arrow-hl"
                        markerWidth="7"
                        markerHeight="5"
                        refX="6"
                        refY="2.5"
                        orient="auto"
                      >
                        <polygon
                          points="0 0, 7 2.5, 0 5"
                          className="fill-secondary/60"
                        />
                      </marker>
                    </defs>
                    {edgePaths.map(({ from, to, d }) => {
                      const isHighlighted = connectedEdges.has(
                        `${from}-${to}`
                      );
                      return (
                        <path
                          key={`${from}-${to}`}
                          d={d}
                          fill="none"
                          strokeWidth={isHighlighted ? 2 : 1.5}
                          className={cn(
                            "transition-all duration-200",
                            isHighlighted
                              ? "stroke-secondary/50"
                              : "stroke-foreground/10"
                          )}
                          markerEnd={
                            isHighlighted
                              ? "url(#arrow-hl)"
                              : "url(#arrow)"
                          }
                        />
                      );
                    })}
                  </svg>
                )}

                {/* Horizontal layers: each layer is a column */}
                <div
                  className="relative flex items-start justify-center gap-10 mx-auto"
                  style={{ zIndex: 1 }}
                >
                  {layers.map((layer, layerIdx) => (
                    <div key={layerIdx} className="flex items-center gap-3">
                      {/* Column of nodes */}
                      <div className="flex flex-col items-center gap-3">
                        {/* Layer label */}
                        <p className="text-[9px] font-bold text-muted/60 uppercase tracking-widest mb-0.5 whitespace-nowrap">
                          {layers.length <= 1
                            ? ""
                            : layerIdx === 0
                              ? "Start"
                              : layerIdx === layers.length - 1
                                ? "Advanced"
                                : `Step ${layerIdx + 1}`}
                        </p>

                        {layer.map((nodeId) => {
                          const node = nodeMap.get(nodeId);
                          if (!node) return null;
                          const mod = moduleMap.get(node.moduleId);
                          const CategoryIcon =
                            CATEGORY_ICONS[node.category] || Code2;
                          const isSelected = selectedNode === nodeId;
                          const hasActiveHighlight =
                            connectedNodeIds.size > 0;
                          const isConnected =
                            connectedNodeIds.has(nodeId);
                          const isDimmed =
                            hasActiveHighlight && !isConnected;

                          return (
                            <div
                              key={nodeId}
                              ref={(el) => {
                                if (el)
                                  nodeRefs.current.set(nodeId, el);
                                else
                                  nodeRefs.current.delete(nodeId);
                              }}
                              onClick={() =>
                                setSelectedNode(
                                  isSelected ? null : nodeId
                                )
                              }
                              onMouseEnter={() =>
                                setHoveredNode(nodeId)
                              }
                              onMouseLeave={() =>
                                setHoveredNode(null)
                              }
                              className={cn(
                                "relative w-[160px] px-3 py-2.5 rounded-xl border-2 cursor-pointer",
                                "transition-all duration-200 select-none",
                                node.status === "completed"
                                  ? "border-accent-green/30 bg-accent-green/[0.04]"
                                  : node.status === "locked"
                                    ? "border-foreground/8 bg-foreground/[0.015]"
                                    : isSelected
                                      ? "border-secondary/60 bg-secondary/[0.06] shadow-[3px_3px_0px_0px] shadow-secondary/15"
                                      : "border-foreground/12 bg-surface hover:border-foreground/25 hover:shadow-[2px_2px_0px_0px] hover:shadow-foreground/6",
                                isDimmed && "opacity-20",
                                node.status === "locked" &&
                                  !isDimmed &&
                                  "opacity-45"
                              )}
                            >
                              {/* Module color indicator */}
                              <div
                                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                                style={{
                                  backgroundColor:
                                    mod?.color || "#6366f1",
                                }}
                              />

                              {/* Completed badge */}
                              {node.status === "completed" && (
                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-accent-green rounded-full flex items-center justify-center border-2 border-surface">
                                  <CheckCircle2
                                    size={11}
                                    className="text-white"
                                  />
                                </div>
                              )}
                              {node.status === "locked" && (
                                <Lock
                                  size={9}
                                  className="absolute top-2 right-2 text-muted/40"
                                />
                              )}

                              <div className="flex items-center gap-1.5 mb-1.5 pl-1">
                                <CategoryIcon
                                  size={13}
                                  className="shrink-0 text-muted/70"
                                />
                                <span className="text-[13px] font-bold leading-tight truncate">
                                  {node.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 pl-1">
                                <span className="flex gap-[3px]">
                                  {Array.from({ length: 5 }).map(
                                    (_, i) => (
                                      <span
                                        key={i}
                                        className={cn(
                                          "w-[5px] h-[5px] rounded-full",
                                          i < node.difficulty
                                            ? "bg-foreground/40"
                                            : "bg-foreground/8"
                                        )}
                                      />
                                    )
                                  )}
                                </span>
                                <span className="text-[10px] text-muted font-medium flex items-center gap-0.5">
                                  <Clock size={9} />
                                  {node.estimatedMinutes}m
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Arrow between columns */}
                      {layerIdx < layers.length - 1 && (
                        <ArrowRightIcon
                          size={14}
                          className="text-foreground/12 shrink-0 mt-4"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Selected Node Detail Panel ──────────── */}
      {selectedNodeData && viewMode === "tree" && (
        <div ref={detailRef} className="animate-fade-in">
          <NodeDetailPanel
            node={selectedNodeData}
            module={moduleMap.get(selectedNodeData.moduleId)}
            nodeMap={nodeMap}
            onClose={() => setSelectedNode(null)}
            onNavigate={(id) => setSelectedNode(id)}
          />
        </div>
      )}

      {/* ─── List View ──────────────────────────── */}
      {viewMode === "list" && (
        <ListView
          path={path}
          nodeMap={nodeMap}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
        />
      )}
    </div>
  );
}

// ─── Gap Analysis Banner ──────────────────────────────────────────────

function GapAnalysisBanner({
  gapAnalysis,
  isBeginner,
}: {
  gapAnalysis: {
    summary: string;
    likelyKnown: string[];
    focusAreas: string[];
  };
  isBeginner: boolean;
}) {
  return (
    <Card className="border-2 border-secondary/20 bg-secondary/[0.03]">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-secondary/10 rounded-xl shrink-0">
            {isBeginner ? (
              <Zap size={18} className="text-secondary" />
            ) : (
              <Lightbulb size={18} className="text-secondary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold mb-1.5">
              {isBeginner
                ? "Your Starting Point"
                : "Personalized for You"}
            </p>
            <p className="text-sm text-muted font-medium leading-relaxed mb-3">
              {gapAnalysis.summary}
            </p>

            {isBeginner ? (
              /* Beginners: No "likely known" — show what they'll learn */
              gapAnalysis.focusAreas.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-secondary">
                    What you&apos;ll learn:{" "}
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {gapAnalysis.focusAreas.map((area, i) => (
                      <span
                        key={i}
                        className="text-xs font-medium px-2 py-0.5 bg-secondary/10 text-secondary border border-secondary/20 rounded-md"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )
            ) : (
              /* Intermediate/Advanced: Show both sections */
              <>
                {gapAnalysis.likelyKnown.length > 0 && (
                  <div className="mb-2.5">
                    <span className="text-xs font-bold text-accent-green">
                      You likely know:{" "}
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {gapAnalysis.likelyKnown.map((item, i) => (
                        <span
                          key={i}
                          className="text-xs font-medium px-2 py-0.5 bg-accent-green/10 text-accent-green border border-accent-green/20 rounded-md"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {gapAnalysis.focusAreas.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-primary">
                      Focus areas:{" "}
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {gapAnalysis.focusAreas.map((area, i) => (
                        <span
                          key={i}
                          className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Node Detail Panel ────────────────────────────────────────────────

function NodeDetailPanel({
  node,
  module: mod,
  nodeMap,
  onClose,
  onNavigate,
}: {
  node: SkillNode;
  module?: SkillModule;
  nodeMap: Map<string, SkillNode>;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const CategoryIcon = CATEGORY_ICONS[node.category] || Code2;
  const modColor = mod?.color || "#6366f1";

  return (
    <Card
      className="border-2 overflow-hidden"
      style={{ borderColor: `${modColor}40` }}
    >
      <CardContent className="p-0">
        {/* Colored header bar */}
        <div
          className="px-5 py-4 border-b-2"
          style={{
            backgroundColor: `${modColor}08`,
            borderBottomColor: `${modColor}15`,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center border-2"
                  style={{
                    backgroundColor: `${modColor}15`,
                    borderColor: `${modColor}30`,
                  }}
                >
                  <CategoryIcon
                    size={16}
                    className="text-secondary"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{node.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {mod && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border"
                        style={{
                          color: modColor,
                          backgroundColor: `${modColor}10`,
                          borderColor: `${modColor}25`,
                        }}
                      >
                        {mod.title}
                      </span>
                    )}
                    <Badge
                      variant="default"
                      className="text-[10px] py-0 px-1.5"
                    >
                      {node.category}
                    </Badge>
                    <span className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            i < node.difficulty
                              ? "bg-foreground"
                              : "bg-foreground/15"
                          )}
                        />
                      ))}
                    </span>
                    <span className="text-xs text-muted font-medium flex items-center gap-1">
                      <Clock size={10} />
                      {node.estimatedMinutes} min
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-foreground/5 transition-colors cursor-pointer shrink-0"
            >
              <X size={18} className="text-muted" />
            </button>
          </div>

          {/* Prerequisites */}
          {node.prerequisites.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs font-bold text-muted">
                Requires:
              </span>
              {node.prerequisites.map((preId) => {
                const preNode = nodeMap.get(preId);
                return (
                  <button
                    key={preId}
                    onClick={() => onNavigate(preId)}
                    className="text-xs font-bold px-2 py-0.5 bg-surface border-2 border-foreground/15 rounded-md hover:border-secondary/40 hover:text-secondary transition-colors cursor-pointer"
                  >
                    {preNode?.name || preId}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Explanation + Codebase + Takeaways */}
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                  What is this?
                </p>
                <p className="text-[15px] font-medium leading-[1.7] text-foreground/85">
                  {node.explanation}
                </p>
              </div>

              {node.inYourCodebase && (
                <div className="p-4 bg-secondary/[0.04] border-2 border-secondary/12 rounded-xl">
                  <p className="text-xs font-bold text-secondary mb-2 flex items-center gap-1.5">
                    <Code2 size={13} />
                    In Your Codebase
                  </p>
                  <p className="text-[13px] text-foreground/70 font-medium leading-relaxed">
                    {node.inYourCodebase}
                  </p>
                </div>
              )}

              {node.keyTakeaways.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2.5">
                    Key Takeaways
                  </p>
                  <ul className="space-y-2">
                    {node.keyTakeaways.map((t, i) => (
                      <li
                        key={i}
                        className="text-[13px] font-medium flex items-start gap-2.5 leading-relaxed"
                      >
                        <CheckCircle2
                          size={14}
                          className="text-accent-green shrink-0 mt-0.5"
                        />
                        <span className="text-foreground/70">{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right: Resources */}
            <div>
              <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">
                Learning Resources
              </p>
              {node.resources.length > 0 ? (
                <ResourceCards resources={node.resources} />
              ) : (
                <div className="text-center py-10 text-muted border-2 border-dashed border-foreground/8 rounded-xl">
                  <BookOpen
                    size={28}
                    className="mx-auto mb-2 opacity-30"
                  />
                  <p className="text-sm font-medium">
                    Resources coming soon
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Resource Cards ───────────────────────────────────────────────────

function ResourceCards({
  resources,
}: {
  resources: PlatformRecommendation[];
}) {
  const grouped: Record<string, PlatformRecommendation[]> = {};
  for (const r of resources) {
    if (!grouped[r.intent]) grouped[r.intent] = [];
    grouped[r.intent].push(r);
  }

  const intentOrder = ["start_here", "go_deeper", "quick_reference"];

  return (
    <div className="space-y-4">
      {intentOrder.map((intent) => {
        const group = grouped[intent];
        if (!group?.length) return null;
        const intentInfo = INTENT_LABELS[intent] || {
          label: intent,
          icon: BookOpen,
        };
        const IntentIcon = intentInfo.icon;

        return (
          <div key={intent}>
            <p className="text-[10px] font-bold mb-2 flex items-center gap-1.5 text-muted uppercase tracking-wider">
              <IntentIcon size={11} />
              {intentInfo.label}
            </p>
            <div className="space-y-2">
              {group.map((res, ri) => (
                <a
                  key={ri}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "block p-3 rounded-xl border-2 border-foreground/10",
                    "hover:border-secondary/30 hover:shadow-[2px_2px_0px_0px] hover:shadow-secondary/10",
                    "transition-all group/res cursor-pointer bg-surface"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-md border border-secondary/20">
                          {res.platform}
                        </span>
                        <Badge
                          variant="default"
                          className="text-[10px] py-0 px-1.5"
                        >
                          {res.type}
                        </Badge>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-md border",
                            PRICE_STYLES[res.priceTier] ||
                              PRICE_STYLES.free
                          )}
                        >
                          {res.priceTier === "free"
                            ? "Free"
                            : res.priceTier === "paid"
                              ? "Paid"
                              : "Sub"}
                        </span>
                      </div>
                      <p className="text-sm font-bold group-hover/res:text-secondary transition-colors">
                        {res.title}
                      </p>
                      <p className="text-xs text-muted font-medium mt-0.5 leading-relaxed">
                        {res.whyThisResource}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted font-medium flex items-center gap-1">
                          <Clock size={9} />
                          {res.estimatedDuration}
                        </span>
                        <span className="text-[10px] text-muted font-medium capitalize">
                          {res.difficulty}
                        </span>
                      </div>
                    </div>
                    <ExternalLink
                      size={14}
                      className="shrink-0 text-muted group-hover/res:text-secondary transition-colors mt-1"
                    />
                  </div>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────

function ListView({
  path,
  nodeMap,
  selectedNode,
  onSelectNode,
}: {
  path: LearningPathV2;
  nodeMap: Map<string, SkillNode>;
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
}) {
  return (
    <div className="space-y-5">
      {path.modules.map((mod) => {
        const moduleNodes = mod.nodeIds
          .map((id) => nodeMap.get(id))
          .filter((n): n is SkillNode => !!n);
        if (moduleNodes.length === 0) return null;

        const completed = moduleNodes.filter(
          (n) => n.status === "completed"
        ).length;

        return (
          <Card
            key={mod.id}
            className="border-2 border-foreground/15 overflow-hidden"
          >
            {/* Module Header */}
            <div
              className="p-4 border-b-2 border-foreground/10"
              style={{ borderLeftWidth: "4px", borderLeftColor: mod.color || "#6366f1" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold">{mod.title}</p>
                  <p className="text-xs text-muted font-medium mt-0.5">
                    {mod.description}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted font-bold">
                    {completed}/{moduleNodes.length}
                  </span>
                  <ProgressRing
                    progress={
                      moduleNodes.length > 0
                        ? (completed / moduleNodes.length) * 100
                        : 0
                    }
                    size={30}
                    strokeWidth={2.5}
                    color={mod.color || "#6366f1"}
                    textClass="text-[7px] font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Concept List */}
            <div>
              {moduleNodes.map((node, i) => {
                const CategoryIcon =
                  CATEGORY_ICONS[node.category] || Code2;
                const isSelected = selectedNode === node.id;

                return (
                  <div key={node.id}>
                    <button
                      onClick={() =>
                        onSelectNode(isSelected ? null : node.id)
                      }
                      className={cn(
                        "w-full text-left p-4 flex items-center gap-3 transition-all cursor-pointer",
                        isSelected
                          ? "bg-secondary/[0.04]"
                          : "hover:bg-foreground/[0.02]",
                        node.status === "locked" && "opacity-50"
                      )}
                    >
                      <div className="shrink-0">
                        {node.status === "completed" ? (
                          <CheckCircle2
                            size={18}
                            className="text-accent-green"
                          />
                        ) : node.status === "locked" ? (
                          <Lock
                            size={18}
                            className="text-muted"
                          />
                        ) : (
                          <CategoryIcon
                            size={18}
                            className="text-foreground/50"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">
                            {node.name}
                          </span>
                          <span className="flex gap-0.5">
                            {Array.from({ length: 5 }).map(
                              (_, j) => (
                                <span
                                  key={j}
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    j < node.difficulty
                                      ? "bg-foreground"
                                      : "bg-foreground/15"
                                  )}
                                />
                              )
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted font-medium flex items-center gap-1">
                            <Clock size={10} />
                            {node.estimatedMinutes} min
                          </span>
                          <Badge
                            variant="default"
                            className="text-[10px] py-0 px-1.5"
                          >
                            {node.category}
                          </Badge>
                          {node.prerequisites.length > 0 && (
                            <span className="text-[10px] text-muted font-medium">
                              {node.prerequisites.length}{" "}
                              prerequisite
                              {node.prerequisites.length > 1
                                ? "s"
                                : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected ? (
                        <ChevronDown
                          size={16}
                          className="shrink-0 text-muted"
                        />
                      ) : (
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-muted"
                        />
                      )}
                    </button>

                    {/* Expanded Detail */}
                    {isSelected && (
                      <div className="px-4 pb-4 border-t border-foreground/10 pt-4 ml-10 space-y-4 animate-fade-in">
                        <p className="text-sm font-medium leading-relaxed">
                          {node.explanation}
                        </p>

                        {node.inYourCodebase && (
                          <div className="p-3 bg-secondary/[0.05] border-2 border-secondary/15 rounded-xl">
                            <p className="text-xs font-bold text-secondary mb-1 flex items-center gap-1">
                              <Code2 size={12} />
                              In Your Codebase
                            </p>
                            <p className="text-xs text-muted font-medium leading-relaxed">
                              {node.inYourCodebase}
                            </p>
                          </div>
                        )}

                        {node.keyTakeaways.length > 0 && (
                          <div>
                            <p className="text-xs font-bold mb-1.5">
                              Key Takeaways
                            </p>
                            <ul className="space-y-1">
                              {node.keyTakeaways.map((t, j) => (
                                <li
                                  key={j}
                                  className="text-xs text-muted font-medium flex items-start gap-1.5"
                                >
                                  <CheckCircle2
                                    size={11}
                                    className="text-accent-green shrink-0 mt-0.5"
                                  />
                                  {t}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {node.prerequisites.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-muted">
                              Requires:
                            </span>
                            {node.prerequisites.map((preId) => {
                              const preNode = nodeMap.get(preId);
                              return (
                                <button
                                  key={preId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectNode(preId);
                                  }}
                                  className="text-xs font-bold px-2 py-0.5 bg-foreground/5 border border-foreground/15 rounded-md hover:border-secondary/40 hover:text-secondary transition-colors cursor-pointer"
                                >
                                  {preNode?.name || preId}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {node.resources.length > 0 && (
                          <ResourceCards resources={node.resources} />
                        )}
                      </div>
                    )}

                    {/* Divider */}
                    {i < moduleNodes.length - 1 && !isSelected && (
                      <div className="mx-4 border-t border-foreground/5" />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── V1 Learning Path (backward compat) ───────────────────────────────

function V1LearningPath({ path }: { path: LearningPathV1 }) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set()
  );

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  if (!path.modules || path.modules.length === 0) {
    return (
      <div className="text-center py-16">
        <GraduationCap size={48} className="mx-auto mb-4 text-muted" />
        <p className="text-lg font-bold text-muted">
          No learning path available.
        </p>
        <p className="text-sm text-muted mt-1">
          Run a skill assessment first to generate a personalized
          learning path.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold mb-1">
          <GraduationCap size={20} />
          {path.title}
        </h2>
        {path.description && (
          <p className="text-sm text-muted font-medium">
            {path.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <Badge variant="secondary">
            {path.modules.length} modules
          </Badge>
          <Badge variant="default">{path.totalLessons} lessons</Badge>
          {path.skillLevel && (
            <Badge variant="warning" className="capitalize">
              {path.skillLevel}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {path.modules.map((mod, mi) => {
          const isExpanded = expandedModules.has(mod.id);
          const accentColors = [
            "border-l-primary",
            "border-l-secondary",
            "border-l-accent-yellow",
            "border-l-accent-green",
            "border-l-accent-purple",
          ];
          const accentColor = accentColors[mi % accentColors.length];

          return (
            <Card
              key={mod.id}
              className={cn(
                "border-2 border-foreground/15 overflow-hidden border-l-[5px]",
                accentColor
              )}
            >
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-foreground/[0.02] transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white bg-foreground px-2 py-0.5 rounded-md">
                      M{mi + 1}
                    </span>
                    <Badge variant="default" className="text-xs">
                      {mod.techStack}
                    </Badge>
                    <span className="text-xs text-muted font-medium">
                      {mod.lessons.length} lesson
                      {mod.lessons.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-base font-bold">{mod.title}</p>
                  <p className="text-sm text-muted font-medium mt-0.5">
                    {mod.description}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronDown
                    size={18}
                    className="shrink-0 text-muted ml-3"
                  />
                ) : (
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-muted ml-3"
                  />
                )}
              </button>

              {isExpanded && (
                <CardContent className="pt-0 pb-4 border-t-2 border-foreground/10">
                  <div className="space-y-4 mt-4">
                    {mod.lessons.map((lesson, li) => (
                      <div
                        key={lesson.id}
                        className={cn(
                          "p-3 rounded-xl border border-foreground/10",
                          "hover:border-foreground/20 transition-colors"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-secondary text-white text-xs font-bold border-2 border-secondary">
                            {li + 1}
                          </span>
                          <p className="text-sm font-bold">
                            {lesson.title}
                          </p>
                        </div>
                        <p className="text-xs text-muted font-medium ml-8">
                          {lesson.description}
                        </p>
                        {lesson.keyConceptsFromCode && (
                          <p className="text-xs text-secondary/80 font-medium ml-8 mt-1 italic">
                            From your code:{" "}
                            {lesson.keyConceptsFromCode}
                          </p>
                        )}
                        {lesson.resources.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 ml-8">
                            {lesson.resources.map((res, ri) => (
                              <a
                                key={ri}
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5",
                                  "rounded-lg border border-foreground/15 bg-surface",
                                  "text-secondary hover:bg-secondary/10 hover:border-secondary/30",
                                  "transition-all duration-200 cursor-pointer"
                                )}
                              >
                                <ExternalLink size={10} />
                                {res.source}
                                <span className="text-muted font-medium">
                                  · {res.type}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
