import type { CanvasFlowEdge, CanvasFlowNode } from "./canvasTypes";

const COLUMN_GAP = 360;
const ROW_GAP = 190;
const ORIGIN_X = 80;
const ORIGIN_Y = 80;

/**
 * Arrange nodes left-to-right by dependency depth. Roots (no incoming edge) sit
 * in the first column; each edge pushes its target one column right. Nodes in a
 * column are stacked vertically and the whole column is centred. Dependency-free
 * and tuned for the small graphs this canvas produces (≈5-15 nodes).
 */
export function layoutGraph(nodes: CanvasFlowNode[], edges: CanvasFlowEdge[]): CanvasFlowNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const ids = new Set(nodes.map((node) => node.id));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const node of nodes) {
    indegree.set(node.id, 0);
  }
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) {
      continue;
    }
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  // Longest-path layering via BFS from the roots so dependents always sit to the right.
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const node of nodes) {
    if ((indegree.get(node.id) ?? 0) === 0) {
      depth.set(node.id, 0);
      queue.push(node.id);
    }
  }
  // Disconnected nodes (part of a cycle or orphaned) default to column 0.
  for (const node of nodes) {
    if (!depth.has(node.id)) {
      depth.set(node.id, 0);
    }
  }

  const remaining = new Map(indegree);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentDepth = depth.get(current) ?? 0;
    for (const next of outgoing.get(current) ?? []) {
      depth.set(next, Math.max(depth.get(next) ?? 0, currentDepth + 1));
      const left = (remaining.get(next) ?? 0) - 1;
      remaining.set(next, left);
      if (left <= 0) {
        queue.push(next);
      }
    }
  }

  const columns = new Map<number, string[]>();
  for (const node of nodes) {
    const column = depth.get(node.id) ?? 0;
    columns.set(column, [...(columns.get(column) ?? []), node.id]);
  }

  const tallest = Math.max(...[...columns.values()].map((column) => column.length));
  const position = new Map<string, { x: number; y: number }>();
  for (const [column, columnIds] of columns) {
    const offset = ((tallest - columnIds.length) * ROW_GAP) / 2;
    columnIds.forEach((id, row) => {
      position.set(id, {
        x: ORIGIN_X + column * COLUMN_GAP,
        y: ORIGIN_Y + offset + row * ROW_GAP,
      });
    });
  }

  return nodes.map((node) => ({ ...node, position: position.get(node.id) ?? node.position }));
}
