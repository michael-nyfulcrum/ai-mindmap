import type { CanvasFlowEdge, CanvasFlowNode } from "./canvasTypes";

const COLUMN_GAP = 110;
const ROW_GAP = 64;
const ORIGIN_X = 80;
const ORIGIN_Y = 80;
const FALLBACK_WIDTH = 330;
const FALLBACK_HEIGHT = 190;

function nodeWidth(node: CanvasFlowNode): number {
  return node.measured?.width ?? node.width ?? FALLBACK_WIDTH;
}

function nodeHeight(node: CanvasFlowNode): number {
  return node.measured?.height ?? node.height ?? FALLBACK_HEIGHT;
}

/**
 * Arrange nodes left-to-right by dependency depth. Roots (no incoming edge) sit
 * in the first column; each edge pushes its target one column right. Columns and
 * rows are spaced using each node's actual measured size, so cards never overlap
 * regardless of how tall their content makes them. Dependency-free; tuned for the
 * small graphs this canvas produces.
 */
export function layoutGraph(nodes: CanvasFlowNode[], edges: CanvasFlowEdge[]): CanvasFlowNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const node of nodes) {
    indegree.set(node.id, 0);
  }
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target) || edge.source === edge.target) {
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

  // Group node ids by column, preserving input order within each column.
  const columns = new Map<number, string[]>();
  for (const node of nodes) {
    const column = depth.get(node.id) ?? 0;
    columns.set(column, [...(columns.get(column) ?? []), node.id]);
  }

  const sortedColumns = [...columns.entries()].sort((a, b) => a[0] - b[0]);

  // Total stacked height of each column (sum of node heights + gaps) for centering.
  const columnHeights = sortedColumns.map(([, ids]) =>
    ids.reduce((sum, id) => sum + nodeHeight(nodeById.get(id) as CanvasFlowNode), 0) + ROW_GAP * Math.max(0, ids.length - 1),
  );
  const tallest = Math.max(...columnHeights, 0);

  const position = new Map<string, { x: number; y: number }>();
  let x = ORIGIN_X;
  sortedColumns.forEach(([, ids], columnIndex) => {
    let y = ORIGIN_Y + (tallest - columnHeights[columnIndex]) / 2;
    let columnWidth = FALLBACK_WIDTH;
    for (const id of ids) {
      const node = nodeById.get(id) as CanvasFlowNode;
      position.set(id, { x, y });
      y += nodeHeight(node) + ROW_GAP;
      columnWidth = Math.max(columnWidth, nodeWidth(node));
    }
    x += columnWidth + COLUMN_GAP;
  });

  return nodes.map((node) => ({ ...node, position: position.get(node.id) ?? node.position }));
}
