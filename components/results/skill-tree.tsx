"use client";

import { useMemo } from "react";
import dagre from "dagre";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Clock, Zap,
  Code2, Layers, GitBranch, Wrench, Building2, Library,
} from "lucide-react";
import type { SkillNode, SkillEdge, SkillModule, ConceptCategory } from "@/types/learning";

// ─── Constants ──────────────────────────────────────────────────────

const NODE_WIDTH = 220;
const NODE_HEIGHT = 84;
const PADDING = 48;

const CATEGORY_ICONS: Record<ConceptCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  language: Code2,
  framework: Layers,
  pattern: GitBranch,
  tooling: Wrench,
  architecture: Building2,
  library: Library,
};

// ─── Layout ─────────────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  node: SkillNode;
}

interface LayoutEdge {
  from: { x: number; y: number };
  to: { x: number; y: number };
  edge: SkillEdge;
}

function computeLayout(
  nodes: SkillNode[],
  edges: SkillEdge[]
): { layoutNodes: LayoutNode[]; layoutEdges: LayoutEdge[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "LR",
    nodesep: 36,
    ranksep: 70,
    marginx: PADDING,
    marginy: PADDING,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      g.setEdge(edge.from, edge.to);
    }
  }

  dagre.layout(g);

  const layoutNodes: LayoutNode[] = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      id: node.id,
      x: pos.x - NODE_WIDTH / 2,
      y: pos.y - NODE_HEIGHT / 2,
      node,
    };
  });

  const layoutEdges: LayoutEdge[] = edges
    .filter((e) => g.hasNode(e.from) && g.hasNode(e.to))
    .map((edge) => {
      const fromPos = g.node(edge.from);
      const toPos = g.node(edge.to);
      return {
        from: { x: fromPos.x + NODE_WIDTH / 2, y: fromPos.y },
        to: { x: toPos.x - NODE_WIDTH / 2, y: toPos.y },
        edge,
      };
    });

  const graphInfo = g.graph();
  return {
    layoutNodes,
    layoutEdges,
    width: (graphInfo.width || 800) + PADDING * 2,
    height: (graphInfo.height || 600) + PADDING * 2,
  };
}

// ─── Edge Component ─────────────────────────────────────────────────

function SkillEdgeComponent({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const midX = (from.x + to.x) / 2;
  const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;

  return (
    <path
      d={path}
      fill="none"
      stroke="#94a3b8"
      strokeWidth={2}
      markerEnd="url(#arrowhead)"
    />
  );
}

// ─── Node Component ─────────────────────────────────────────────────

interface SkillNodeComponentProps {
  layoutNode: LayoutNode;
  moduleColor: string;
  onClick: (nodeId: string) => void;
}

function SkillNodeComponent({ layoutNode, moduleColor, onClick }: SkillNodeComponentProps) {
  const { node, x, y } = layoutNode;
  const IconComponent = CATEGORY_ICONS[node.category] || Code2;
  const isCompleted = node.status === "completed";

  return (
    <g
      className="cursor-pointer"
      onClick={() => onClick(node.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(node.id)}
    >
      {/* Shadow */}
      <rect
        x={x + 2}
        y={y + 2}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={10}
        fill="#1E293B"
        opacity={0.08}
      />

      {/* Card background */}
      <rect
        x={x}
        y={y}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={10}
        fill={isCompleted ? "#f0fdf4" : "#ffffff"}
        stroke={isCompleted ? "#86efac" : "#cbd5e1"}
        strokeWidth={2}
      />

      {/* Module color indicator */}
      <rect
        x={x}
        y={y + 10}
        width={5}
        height={NODE_HEIGHT - 20}
        rx={2.5}
        fill={moduleColor}
      />

      {/* Status indicator */}
      {isCompleted && (
        <foreignObject x={x + NODE_WIDTH - 26} y={y + 6} width={20} height={20}>
          <CheckCircle2 size={16} className="text-accent-green" />
        </foreignObject>
      )}

      {/* Content */}
      <foreignObject x={x + 16} y={y + 10} width={NODE_WIDTH - 46} height={NODE_HEIGHT - 20}>
        <div className="h-full flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-1.5">
            <IconComponent size={13} className="shrink-0 text-muted" />
            <span className="text-xs font-bold truncate leading-tight">
              {node.name}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-0.5 text-[10px] text-muted font-medium">
              <Zap size={9} />
              {"●".repeat(node.difficulty)}{"○".repeat(5 - node.difficulty)}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-muted font-medium">
              <Clock size={9} />
              {node.estimatedMinutes}m
            </span>
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

// ─── Main Skill Tree ────────────────────────────────────────────────

interface SkillTreeProps {
  nodes: SkillNode[];
  edges: SkillEdge[];
  modules: SkillModule[];
  onNodeClick: (nodeId: string) => void;
  className?: string;
}

export function SkillTree({ nodes, edges, modules, onNodeClick, className }: SkillTreeProps) {
  // Build module color lookup
  const moduleColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const mod of modules) {
      for (const nodeId of mod.nodeIds) {
        map.set(nodeId, mod.color);
      }
    }
    return map;
  }, [modules]);

  // Compute DAG layout
  const { layoutNodes, layoutEdges, width, height } = useMemo(
    () => computeLayout(nodes, edges),
    [nodes, edges]
  );

  if (nodes.length === 0) return null;

  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-xl border-2 border-foreground/10 bg-background",
        className
      )}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block min-w-full"
      >
        <defs>
          {/* Dot grid pattern */}
          <pattern id="dotgrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="0.8" fill="#cbd5e1" opacity="0.5" />
          </pattern>
          <marker
            id="arrowhead"
            viewBox="0 0 10 7"
            refX="10"
            refY="3.5"
            markerWidth={8}
            markerHeight={6}
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
        </defs>

        {/* Background pattern */}
        <rect width={width} height={height} fill="url(#dotgrid)" />

        {/* Edges */}
        {layoutEdges.map((le, i) => (
          <SkillEdgeComponent key={i} from={le.from} to={le.to} />
        ))}

        {/* Nodes */}
        {layoutNodes.map((ln) => (
          <SkillNodeComponent
            key={ln.id}
            layoutNode={ln}
            moduleColor={moduleColorMap.get(ln.id) || "#6366F1"}
            onClick={onNodeClick}
          />
        ))}
      </svg>
    </div>
  );
}
