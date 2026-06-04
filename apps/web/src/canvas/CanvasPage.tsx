import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Controls,
  getNodesBounds,
  getViewportForBounds,
  MarkerType,
  MiniMap,
  ReactFlow,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { Circle, Code2, LayoutGrid, Maximize2, Minimize2, PanelRightOpen, Plug } from "lucide-react";
import { CanvasAiPanel } from "./CanvasAiPanel";
const ConnectAgentModal = lazy(() => import("./ConnectAgentModal").then((m) => ({ default: m.ConnectAgentModal })));
const DeveloperHandoffPanel = lazy(() => import("./DeveloperHandoffPanel").then((m) => ({ default: m.DeveloperHandoffPanel })));
const CommandPalette = lazy(() => import("./CommandPalette").then((m) => ({ default: m.CommandPalette })));
const ShortcutsOverlay = lazy(() => import("./ShortcutsOverlay").then((m) => ({ default: m.ShortcutsOverlay })));
import { CanvasInspector } from "./CanvasInspector";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasTypeFilter } from "./CanvasTypeFilter";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { EdgeInspector } from "./EdgeInspector";
import { GalaxyBackground } from "./GalaxyBackground";
import { ProjectCarousel } from "./ProjectCarousel";
import {
  createChat,
  createProject,
  createSpec,
  deleteChat,
  deleteProject,
  generateProject,
  listChats,
  listProjects,
  loadCanvas,
  loadChat,
  renameProject,
  saveCanvas,
  sendChatMessage,
  suggestChanges,
  uploadAsset,
} from "../api/canvasApi";
import { layoutGraph } from "./autoLayout";
import { SuggestionReview } from "./SuggestionReview";
import { toast } from "../shared/toast";
import {
  defaultFieldsForType,
  titleForType,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasNodeData,
  type CanvasNodeType,
  type CanvasProject,
  type ChatMessage,
  type ChatThread,
  type ProposedChange,
  type SuggestionResponse,
} from "./canvasTypes";
import { ContextNode } from "./nodes/ContextNode";
import { Button } from "../shared/ui/Button";
import { Spinner } from "../shared/ui/Spinner";
import { createId } from "../shared/ids";
import { nowIso, formatRelativeTime } from "../shared/time";
import { errorDetail } from "../shared/errors";
import { isEditableTarget } from "../shared/dom";
import { downloadText, slugify } from "../shared/download";
import { copyText } from "../shared/clipboard";
import { buildCanvasMarkdown } from "./exportMarkdown";
import { PROJECT_TEMPLATES } from "./projectTemplates";

const nodeTypes = { contextNode: ContextNode };
const AppLoading = lazy(() => import("../app/AppLoading").then((module) => ({ default: module.AppLoading })));
const MIN_LOADING_MS = 4200;

export function CanvasPage() {
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(true);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [projectLoadingLabel, setProjectLoadingLabel] = useState("Loading project...");
  const [project, setProject] = useState<CanvasProject>({
    id: "",
    name: "AI Mindmap",
    description: "Loading workspace...",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<CanvasFlowNode>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<CanvasFlowEdge>([]);
  const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);
  const [activeEdgeIds, setActiveEdgeIds] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<CanvasNodeType>>(() => new Set());
  const [proposal, setProposal] = useState<SuggestionResponse | null>(null);
  const [ghostPositions, setGhostPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [isSuggesting, setIsSuggesting] = useState(false);
  // Only one AI action (chat/plan or suggestions) may run at a time so requests
  // don't race or stack. Every AI trigger checks this before starting.
  const aiBusy = isSending || isSuggesting;
  const { fitView, screenToFlowPosition, getViewport, setCenter } = useReactFlow();
  const projectId = project.id;
  const snapshotRef = useRef({ project, nodes, edges });
  const getViewportRef = useRef(getViewport);
  const dirtyRef = useRef(false);
  const handleSelectProjectRef = useRef<(id: string) => void>(() => {});

  const activeNodes = useMemo(() => nodes.filter((node) => activeNodeIds.includes(node.id)), [activeNodeIds, nodes]);
  const selectedNode = activeNodes.length === 1 ? activeNodes[0] : null;
  const selectedEdge = useMemo(
    () => (activeEdgeIds.length === 1 ? edges.find((edge) => edge.id === activeEdgeIds[0]) ?? null : null),
    [activeEdgeIds, edges],
  );
  // Render every edge as a curved bezier with a directional arrowhead. Edges that
  // touch an AI-flagged node animate so the impact ripples along its connections.
  const flaggedNodeIds = useMemo(
    () => new Set(nodes.filter((node) => node.data.impact).map((node) => node.id)),
    [nodes],
  );
  const committedNodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const proposalView = useMemo(
    () => buildProposalView(proposal, ghostPositions, committedNodeIds),
    [proposal, ghostPositions, committedNodeIds],
  );

  const displayNodes = useMemo(() => {
    let base = !proposal
      ? nodes
      : nodes
          .map((node) =>
            proposalView.updateNodeIds.has(node.id)
              ? { ...node, data: { ...node.data, proposed: "update" as const, rationale: proposalView.updateRationale.get(node.id) } }
              : node,
          )
          .concat(proposalView.proposedNodes);
    // Locked nodes can't be dragged; only clone those to keep refs stable elsewhere.
    if (base.some((node) => node.data.locked)) {
      base = base.map((node) => (node.data.locked ? { ...node, draggable: false } : node));
    }
    if (typeFilter.size === 0) {
      return base;
    }
    // Spotlight the chosen types by dimming everything else.
    return base.map((node) =>
      typeFilter.has(node.data.canvasType) ? node : { ...node, style: { ...node.style, opacity: 0.16 } },
    );
  }, [nodes, proposal, proposalView, typeFilter]);

  const displayEdges = useMemo(() => {
    const committed = edges.map((edge) => ({
      ...edge,
      type: "default",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      animated: flaggedNodeIds.has(edge.source) || flaggedNodeIds.has(edge.target),
    }));
    return proposal ? [...committed, ...proposalView.proposedEdges] : committed;
  }, [edges, flaggedNodeIds, proposal, proposalView]);

  useEffect(() => {
    snapshotRef.current = { project, nodes, edges };
  }, [edges, nodes, project]);

  useEffect(() => {
    getViewportRef.current = getViewport;
  }, [getViewport]);

  const loadProjectChats = useCallback(async (projectId: string) => {
    const loaded = await listChats(projectId);
    if (loaded.chats.length === 0) {
      setChats([]);
      setActiveChatId(null);
      setMessages([]);
      return;
    }

    setChats(loaded.chats);
    setActiveChatId(loaded.chats[0].id);
    const active = await loadChat(projectId, loaded.chats[0].id);
    setMessages(active.messages);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProjectList() {
      const minimumLoading = delay(MIN_LOADING_MS);
      try {
        const result = await listProjects();
        if (!cancelled) setProjects(result.projects);
      } catch {
        // Surface the failure so an unreachable backend doesn't look like an
        // empty workspace; the user can still try creating a project.
        if (!cancelled) {
          toast.error("Couldn’t reach the server", "boot", "Check that the API is running, then reload.");
        }
      }
      await minimumLoading;
      if (cancelled) return;
      setIsBooting(false);
      const deepLinkId = parseCanvasId(window.location.pathname);
      if (deepLinkId) {
        handleSelectProjectRef.current(deepLinkId);
      }
    }

    void loadProjectList();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep app state in sync with browser back/forward navigation.
  useEffect(() => {
    function onPopState() {
      const id = parseCanvasId(window.location.pathname);
      if (id) {
        if (id === snapshotRef.current.project.id) {
          setShowProjectPicker(false);
        } else {
          handleSelectProjectRef.current(id);
        }
      } else {
        setShowProjectPicker(true);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const persist = useCallback(
    async (options?: { nodes?: CanvasFlowNode[]; commitMessage?: string }): Promise<boolean> => {
      const {
        project: currentProject,
        nodes: snapshotNodes,
        edges: currentEdges,
      } = snapshotRef.current;
      const currentNodes = options?.nodes ?? snapshotNodes;
      if (!currentProject.id) {
        return false;
      }
      const updatedProject = {
        ...currentProject,
        updatedAt: nowIso(),
        viewport: getViewportRef.current(),
      };
      dirtyRef.current = false;
      setProject(updatedProject);
      setSaveState("saving");
      try {
        const saved = await saveCanvas(
          { project: updatedProject, nodes: currentNodes, edges: currentEdges },
          options?.commitMessage,
        );
        setProject(saved.project);
        setNodes(saved.nodes);
        setEdges(saved.edges);
        setSaveState("saved");
        setLastSavedAt(Date.now());
        return true;
      } catch {
        dirtyRef.current = true;
        setSaveState("error");
        return false;
      }
    },
    [setEdges, setNodes],
  );

  useEffect(() => {
    if (!projectId || !dirtyRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      dirtyRef.current = false;
      void persist();
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [edges, nodes, persist, projectId]);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      // Drop changes targeting ghost/proposed nodes — they live outside committed state.
      const committed = changes.filter((change) => !("id" in change && isProposedId(change.id)));
      if (committed.length === 0) {
        return;
      }
      if (committed.some(nodeChangeAffectsPersistence)) {
        dirtyRef.current = true;
      }
      onNodesChangeBase(committed);
    },
    [onNodesChangeBase],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<CanvasFlowEdge>[]) => {
      if (changes.some(edgeChangeAffectsPersistence)) {
        dirtyRef.current = true;
      }
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase],
  );

  const addNode = useCallback(
    (type: CanvasNodeType, patch?: Partial<CanvasNodeData>) => {
      const id = createId("node");
      const position = screenToFlowPosition({
        x: Math.max(220, window.innerWidth / 2 - 140),
        y: Math.max(140, window.innerHeight / 2 - 80),
      });
      const timestamp = nowIso();
      const node: CanvasFlowNode = {
        id,
        type: "contextNode",
        position,
        data: {
          canvasType: type,
          title: patch?.title ?? `New ${type.replaceAll("_", " ")}`,
          fields: { ...defaultFieldsForType(), ...(patch?.fields ?? {}) },
          tags: patch?.tags ?? [],
          updatedAt: timestamp,
        },
      };
      dirtyRef.current = true;
      setNodes((current) => current.concat(node));
      setActiveNodeIds([id]);
      setActiveEdgeIds([]);
      setIsInspectorCollapsed(false);
      toast.success(`${titleForType(type)} node added to the canvas`, "canvas-mutate");
    },
    [screenToFlowPosition, setNodes],
  );

  const addImageNode = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        addNode("image");
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      try {
        const upload = await uploadAsset({
          projectId: project.id,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          dataUrl,
        });
        addNode("image", {
          title: file.name,
          fields: {
            content: `![${file.name}](${upload.url})`,
          },
        });
      } catch (error) {
        setSaveState("error");
        toast.error("Couldn’t upload image", "upload", errorDetail(error));
      }
    };
    input.click();
  }, [addNode, project.id]);

  const handleAddNode = useCallback(
    (type: CanvasNodeType) => {
      if (type === "image") {
        addImageNode();
        return;
      }
      addNode(type);
    },
    [addImageNode, addNode],
  );

  const connectNodes = useCallback(
    (connection: Connection) => {
      const timestamp = nowIso();
      const edgeId = createId("edge");
      dirtyRef.current = true;
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: edgeId,
            type: "default",
            label: "references",
            data: { relationship: "references", updatedAt: timestamp },
          },
          current,
        ),
      );
      // Select the new edge so its relationship can be picked right away.
      setActiveNodeIds([]);
      setActiveEdgeIds([edgeId]);
    },
    [setEdges],
  );

  const updateEdgeLabel = useCallback(
    (edgeId: string, relationship: string) => {
      dirtyRef.current = true;
      setEdges((current) =>
        current.map((edge) =>
          edge.id === edgeId
            ? { ...edge, label: relationship, data: { relationship, updatedAt: nowIso() } }
            : edge,
        ),
      );
    },
    [setEdges],
  );

  const reconnectEdgeEndpoint = useCallback(
    (oldEdge: CanvasFlowEdge, newConnection: Connection) => {
      dirtyRef.current = true;
      setEdges((current) => reconnectEdge(oldEdge, newConnection, current));
    },
    [setEdges],
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (connection.source === connection.target) {
        return false;
      }
      return !snapshotRef.current.edges.some(
        (edge) => edge.source === connection.source && edge.target === connection.target,
      );
    },
    [],
  );

  const handleManualSave = useCallback(async () => {
    if (!project.id) {
      return;
    }
    const ok = await persist();
    if (ok) {
      toast.success("Canvas saved", "manual-save");
    } else {
      toast.error("Couldn’t save — your changes are still here", "manual-save");
    }
  }, [persist, project.id]);

  // Global canvas shortcuts: ? opens help, Cmd/Ctrl+S saves, Cmd/Ctrl+K opens the command palette.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "?" && !isEditableTarget(event.target)) {
        event.preventDefault();
        setIsShortcutsOpen(true);
        return;
      }
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void handleManualSave();
      } else if (key === "k") {
        event.preventDefault();
        setIsCommandOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleManualSave]);

  const exportCanvasImage = useCallback(() => {
    const viewportEl = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!viewportEl || nodes.length === 0) {
      return;
    }
    const width = 1920;
    const height = 1080;
    const bounds = getNodesBounds(nodes);
    const viewport = getViewportForBounds(bounds, width, height, 0.4, 2, 0.12);
    void toPng(viewportEl, {
      backgroundColor: "#060b18",
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `${project.name.replace(/\s+/g, "-").toLowerCase() || "canvas"}.png`;
        link.href = dataUrl;
        link.click();
        toast.success("Canvas exported as PNG", "export-image");
      })
      .catch(() => {
        toast.error("Couldn’t export the canvas — try again", "export-image");
      });
  }, [nodes, project.name]);

  const exportCanvasMarkdown = useCallback(() => {
    const { project: currentProject, nodes: currentNodes, edges: currentEdges } = snapshotRef.current;
    const markdown = buildCanvasMarkdown(currentProject, currentNodes, currentEdges);
    downloadText(`${slugify(currentProject.name)}.md`, markdown, "text/markdown");
    toast.success("Canvas exported as Markdown", "export-md");
  }, []);

  const copyCanvasMarkdown = useCallback(async () => {
    const { project: currentProject, nodes: currentNodes, edges: currentEdges } = snapshotRef.current;
    const ok = await copyText(buildCanvasMarkdown(currentProject, currentNodes, currentEdges));
    if (ok) {
      toast.success("Context copied as Markdown", "copy-md");
    } else {
      toast.error("Couldn’t copy to clipboard", "copy-md", "Try Export Markdown instead.");
    }
  }, []);

  const exportCanvasJson = useCallback(() => {
    const { project: currentProject, nodes: currentNodes, edges: currentEdges } = snapshotRef.current;
    const payload = JSON.stringify({ project: currentProject, nodes: currentNodes, edges: currentEdges }, null, 2);
    downloadText(`${slugify(currentProject.name)}.json`, payload, "application/json");
    toast.success("Canvas exported as JSON", "export-json");
  }, []);

  const importCanvasJson = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      try {
        const parsed = JSON.parse(await file.text());
        const importedNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
        const importedEdges = Array.isArray(parsed?.edges) ? parsed.edges : [];
        if (importedNodes.length === 0) {
          throw new Error("No nodes found in this file.");
        }
        const baseName = typeof parsed?.project?.name === "string" ? parsed.project.name : "Imported canvas";
        const snapshot = await createProject({
          name: `${baseName} (imported)`,
          description: typeof parsed?.project?.description === "string" ? parsed.project.description : undefined,
          nodes: importedNodes,
          edges: importedEdges,
        });
        setProjects((prev) => [snapshot.project, ...prev.filter((item) => item.id !== snapshot.project.id)]);
        setProject(snapshot.project);
        setNodes(snapshot.nodes);
        setEdges(snapshot.edges);
        setActiveNodeIds([]);
        setActiveEdgeIds([]);
        setShowProjectPicker(false);
        navigateToCanvas(snapshot.project.id);
        await loadProjectChats(snapshot.project.id);
        setSaveState("saved");
        window.requestAnimationFrame(() => fitView({ padding: 0.18 }));
        toast.success("Canvas imported", "import-json");
      } catch (error) {
        toast.error("Couldn’t import canvas", "import-json", errorDetail(error));
      }
    };
    input.click();
  }, [fitView, loadProjectChats, setEdges, setNodes]);

  const saveNodeVersion = useCallback(
    async (nodeId: string, data: CanvasNodeData, commitMessage: string) => {
      const nextNodes = snapshotRef.current.nodes.map((node) => (node.id === nodeId ? { ...node, data } : node));
      setNodes(nextNodes);
      toast.loading("Saving your changes…", "save-node");
      const ok = await persist({ nodes: nextNodes, commitMessage: commitMessage || undefined });
      if (ok) {
        toast.success("Saved — version logged", "save-node");
      } else {
        toast.error("Couldn’t save — your changes are still here", "save-node");
      }
    },
    [persist, setNodes],
  );

  const deleteActiveItems = useCallback(() => {
    const nodeIds = new Set(activeNodeIds);
    const edgeIds = new Set(activeEdgeIds);
    const removed = activeNodeIds.length + activeEdgeIds.length;
    if (removed === 0) {
      return;
    }
    // Capture everything that disappears — including edges removed by cascade —
    // so Undo can restore the exact prior state.
    const removedNodes = snapshotRef.current.nodes.filter((node) => nodeIds.has(node.id));
    const removedEdges = snapshotRef.current.edges.filter(
      (edge) => edgeIds.has(edge.id) || nodeIds.has(edge.source) || nodeIds.has(edge.target),
    );
    dirtyRef.current = true;
    setNodes((current) => current.filter((node) => !nodeIds.has(node.id)));
    setEdges((current) =>
      current.filter((edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target)),
    );
    setActiveNodeIds([]);
    setActiveEdgeIds([]);
    setIsInspectorCollapsed(false);
    const restore = () => {
      dirtyRef.current = true;
      setNodes((current) => [...current, ...removedNodes]);
      setEdges((current) => [...current, ...removedEdges]);
      setActiveNodeIds(removedNodes.map((node) => node.id));
      toast.success(`Restored ${removed} item${removed === 1 ? "" : "s"}`, "canvas-mutate");
    };
    toast.success(`Removed ${removed} item${removed === 1 ? "" : "s"} from the canvas`, "canvas-mutate", undefined, {
      label: "Undo",
      onClick: restore,
    });
  }, [activeEdgeIds, activeNodeIds, setEdges, setNodes]);

  const duplicateActiveNodes = useCallback(() => {
    const ids = new Set(activeNodeIds);
    const originals = snapshotRef.current.nodes.filter((node) => ids.has(node.id) && !node.data.proposed);
    if (originals.length === 0) {
      return;
    }
    const timestamp = nowIso();
    const clones: CanvasFlowNode[] = originals.map((node) => ({
      ...node,
      id: createId("node"),
      position: { x: node.position.x + 32, y: node.position.y + 32 },
      selected: false,
      data: {
        ...node.data,
        title: `${node.data.title} (copy)`,
        fields: { ...node.data.fields },
        tags: [...node.data.tags],
        updatedAt: timestamp,
        audit: undefined,
        impact: undefined,
        highlighted: false,
      },
    }));
    dirtyRef.current = true;
    setNodes((current) => [...current, ...clones]);
    setActiveNodeIds(clones.map((clone) => clone.id));
    toast.success(`Duplicated ${clones.length} node${clones.length === 1 ? "" : "s"}`, "canvas-mutate");
  }, [activeNodeIds, setNodes]);

  const toggleTypeFilter = useCallback((type: CanvasNodeType) => {
    setTypeFilter((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const clearTypeFilter = useCallback(() => setTypeFilter(new Set()), []);

  // Cmd/Ctrl+D duplicates the current selection (ignored while editing text).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d" && !isEditableTarget(event.target)) {
        event.preventDefault();
        duplicateActiveNodes();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [duplicateActiveNodes]);

  // Cmd/Ctrl+A selects all nodes; arrow keys nudge the current selection.
  useEffect(() => {
    const NUDGE: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        const selectable = snapshotRef.current.nodes.filter((node) => !node.data.proposed);
        setNodes((current) => current.map((node) => ({ ...node, selected: !node.data.proposed })));
        setActiveNodeIds(selectable.map((node) => node.id));
        setActiveEdgeIds([]);
        return;
      }
      const delta = NUDGE[event.key];
      if (delta && !event.metaKey && !event.ctrlKey && activeNodeIds.length > 0) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const ids = new Set(activeNodeIds);
        dirtyRef.current = true;
        setNodes((current) =>
          current.map((node) =>
            ids.has(node.id) && !node.data.locked
              ? { ...node, position: { x: node.position.x + delta[0] * step, y: node.position.y + delta[1] * step } }
              : node,
          ),
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeNodeIds, setNodes]);

  const sendCanvasMessage = useCallback(
    async (
      content: string,
      options?: { forceNewChat?: boolean; chatTitle?: string; loadingMessage?: string },
    ) => {
      if (!project.id || aiBusy) {
        return;
      }

      if (!content.trim()) {
        return;
      }

      setIsSending(true);
      toast.loading(options?.loadingMessage ?? "Thinking through your canvas…", "chat");
      try {
        await persist();
        // A drafted plan always lands in its own fresh thread so it's easy to find.
        let chatId = options?.forceNewChat ? null : activeChatId;
        if (!chatId) {
          const created = await createChat(project.id, options?.chatTitle);
          chatId = created.thread.id;
          setChats((current) => [created.thread, ...current.filter((chat) => chat.id !== created.thread.id)]);
          setActiveChatId(chatId);
          setMessages([]);
        }

        const messageContent = content.trim();
        const result = await sendChatMessage({ projectId: project.id, chatId, content: messageContent });
        setChats((current) => [result.thread, ...current.filter((chat) => chat.id !== result.thread.id)]);
        setMessages(result.messages);
        toast.success("Answer ready", "chat");
      } catch (error) {
        setQuestion(content.trim());
        setSaveState("error");
        toast.error("The AI didn’t respond — try again", "chat", errorDetail(error));
      } finally {
        setIsSending(false);
      }
    },
    [activeChatId, aiBusy, persist, project.id],
  );

  const runAnalysis = useCallback(async () => {
    const content = question.trim();
    setQuestion("");
    await sendCanvasMessage(content);
  }, [question, sendCanvasMessage]);

  // Opens a fresh chat about a node. With an instruction it discusses that; left
  // blank on a flagged node it drafts a structured update plan; otherwise a general
  // walkthrough. Each lands in its own thread so it's easy to find.
  const chatAboutNode = useCallback(
    (node: CanvasFlowNode, instruction?: string) => {
      if (aiBusy) {
        return;
      }
      setIsChatCollapsed(false);
      setQuestion("");
      const text = instruction?.trim();
      const impact = node.data.impact;

      if (text) {
        void sendCanvasMessage(
          [
            `About the node "${node.data.title}" (${node.id}):`,
            text,
            "Use only the saved canvas. Do not change canvas nodes automatically.",
          ].join("\n"),
          {
            forceNewChat: true,
            chatTitle: `Chat · ${node.data.title}`,
            loadingMessage: "Thinking it through…",
          },
        );
        return;
      }

      if (impact) {
        void sendCanvasMessage(
          [
            `Draft an update plan for the flagged node "${node.data.title}" (${node.id}).`,
            `Impact status: ${impact.status}.`,
            `Impact reason: ${impact.reason}`,
            `Source node: ${impact.sourceNodeId}. Source version: ${impact.sourceVersionId}.`,
            "Use only the saved canvas. Include why it was flagged, what needs review, suggested requirement edits, implementation implications, tests or verification, and open questions. Do not change canvas nodes automatically.",
          ].join("\n"),
          {
            forceNewChat: true,
            chatTitle: `Plan · ${node.data.title}`,
            loadingMessage: "Drafting a plan in a new chat…",
          },
        );
        return;
      }

      void sendCanvasMessage(
        `Walk me through the node "${node.data.title}" (${node.id}) and suggest how to strengthen it. Use only the saved canvas. Do not change canvas nodes automatically.`,
        {
          forceNewChat: true,
          chatTitle: `Chat · ${node.data.title}`,
          loadingMessage: "Thinking it through…",
        },
      );
    },
    [aiBusy, sendCanvasMessage],
  );

  const startNewChat = useCallback(async () => {
    if (!project.id) {
      return;
    }

    setIsCreatingChat(true);
    try {
      const created = await createChat(project.id);
      setChats((current) => [created.thread, ...current.filter((chat) => chat.id !== created.thread.id)]);
      setActiveChatId(created.thread.id);
      setMessages([]);
      setQuestion("");
    } catch {
      setSaveState("error");
    } finally {
      setIsCreatingChat(false);
    }
  }, [project.id]);

  const selectChat = useCallback(
    async (chatId: string) => {
      if (!project.id) {
        return;
      }

      setActiveChatId(chatId);
      setMessages([]);
      setLoadingChatId(chatId);
      try {
        const loaded = await loadChat(project.id, chatId);
        setActiveChatId(loaded.thread.id);
        setMessages(loaded.messages);
      } catch {
        setSaveState("error");
      } finally {
        setLoadingChatId(null);
      }
    },
    [project.id],
  );

  const removeChat = useCallback(
    async (chatId: string) => {
      if (!project.id) {
        return;
      }

      await deleteChat(project.id, chatId);
      const remaining = chats.filter((chat) => chat.id !== chatId);
      setChats(remaining);
      if (activeChatId === chatId) {
        const next = remaining[0];
        setActiveChatId(next?.id ?? null);
        if (next) {
          const loaded = await loadChat(project.id, next.id);
          setMessages(loaded.messages);
        } else {
          setMessages([]);
        }
      }
    },
    [activeChatId, chats, project.id],
  );

  const highlightCitations = useCallback(
    (nodeIds: string[]) => {
      const cited = new Set(nodeIds);
      setNodes((current) => current.map((node) => ({ ...node, data: { ...node.data, highlighted: cited.has(node.id) } })));
    },
    [setNodes],
  );

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        return;
      }
      setCenter(node.position.x + 140, node.position.y + 80, { zoom: 1.05, duration: 300 });
      highlightCitations([nodeId]);
      setActiveNodeIds([nodeId]);
      setIsInspectorCollapsed(false);
    },
    [highlightCitations, nodes, setCenter],
  );

  // Fit View focuses the current selection when present, otherwise the whole canvas.
  const handleFitView = useCallback(() => {
    if (activeNodeIds.length > 0) {
      fitView({ nodes: activeNodeIds.map((id) => ({ id })), padding: 0.35, duration: 320 });
    } else {
      fitView({ padding: 0.18, duration: 320 });
    }
  }, [activeNodeIds, fitView]);

  // Focus mode hides both side panels for a distraction-free canvas.
  const toggleFocusMode = useCallback(() => {
    setIsChatCollapsed((collapsed) => {
      const next = !collapsed;
      setIsInspectorCollapsed(next);
      return next;
    });
  }, []);

  // Refresh the "saved Xs ago" label while the canvas sits idle and saved.
  useEffect(() => {
    if (saveState !== "saved" || lastSavedAt == null) {
      return;
    }
    const timer = window.setInterval(() => setSavedTick((tick) => tick + 1), 20000);
    return () => window.clearInterval(timer);
  }, [saveState, lastSavedAt]);

  const savedLabel = useMemo(() => {
    void savedTick;
    if (lastSavedAt == null) {
      return "All changes saved";
    }
    return `Saved ${formatRelativeTime(lastSavedAt)}`;
  }, [lastSavedAt, savedTick]);

  const handleSelectProject = useCallback(
    async (selectedProjectId: string) => {
      setIsLoadingProject(true);
      setProjectLoadingLabel("Opening project...");
      try {
        const snapshot = await loadCanvas(selectedProjectId);
        setProject(snapshot.project);
        setNodes(snapshot.nodes);
        setEdges(snapshot.edges);
        setActiveNodeIds([]);
        setActiveEdgeIds([]);
        await loadProjectChats(snapshot.project.id);
        setSaveState("saved");
        setShowProjectPicker(false);
        navigateToCanvas(snapshot.project.id);
        window.requestAnimationFrame(() => fitView({ padding: 0.18 }));
      } catch {
        setSaveState("error");
        setShowProjectPicker(true);
        navigateToProjects();
      } finally {
        setIsLoadingProject(false);
        setProjectLoadingLabel("Loading project...");
      }
    },
    [fitView, loadProjectChats, setEdges, setNodes],
  );

  useEffect(() => {
    handleSelectProjectRef.current = handleSelectProject;
  }, [handleSelectProject]);

  const handleCreateProject = useCallback(async (templateId?: string) => {
    setIsLoadingProject(true);
    try {
      const template = templateId ? PROJECT_TEMPLATES.find((t) => t.id === templateId) : undefined;
      setProjectLoadingLabel(template ? `Creating ${template.name}...` : "Creating project...");
      const name = template?.defaultProjectName
        ?? `Mindmap ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      const now = nowIso();
      const idMap = template ? new Map(template.nodes.map((n) => [n.id, createId("node")])) : undefined;
      const nodes = template?.nodes.map((n) => ({
        ...n,
        id: idMap?.get(n.id) ?? n.id,
        data: { ...n.data, updatedAt: now },
      }));
      const edges = template?.edges.map((e) => ({
        ...e,
        id: createId("edge"),
        source: idMap?.get(e.source) ?? e.source,
        target: idMap?.get(e.target) ?? e.target,
        data: { relationship: e.data?.relationship ?? "", updatedAt: now },
      }));
      const snapshot = await createProject({
        name,
        description: template?.projectDescription,
        viewport: template?.viewport,
        nodes,
        edges,
      });

      setProjects((prev) => [snapshot.project, ...prev]);
      setProject(snapshot.project);
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      setActiveNodeIds([]);
      setActiveEdgeIds([]);
      await loadProjectChats(snapshot.project.id);
      setSaveState("saved");
      setShowProjectPicker(false);
      navigateToCanvas(snapshot.project.id);
      window.requestAnimationFrame(() => fitView({ padding: 0.18 }));
    } catch {
      setSaveState("error");
    } finally {
      setIsLoadingProject(false);
      setProjectLoadingLabel("Loading project...");
    }
  }, [fitView, loadProjectChats, setEdges, setNodes]);

  const handleGenerateProject = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) {
        return;
      }
      setIsLoadingProject(true);
      setProjectLoadingLabel("Planning your project…");
      try {
        const graph = await generateProject(trimmed);
        const laidOut = layoutGraph(graph.nodes, graph.edges);
        const snapshot = await createProject({
          name: graph.projectName,
          description: graph.projectDescription,
        });
        setProjects((prev) => [snapshot.project, ...prev]);
        setProject(snapshot.project);
        setNodes([]);
        setEdges([]);
        setActiveNodeIds([]);
        setActiveEdgeIds([]);
        await loadProjectChats(snapshot.project.id);
        setSaveState("saved");
        setShowProjectPicker(false);
        setIsLoadingProject(false);
        navigateToCanvas(snapshot.project.id);

        // Stream the plan onto the canvas so the AI looks like it is drawing it.
        dirtyRef.current = false;
        for (const node of laidOut) {
          setNodes((current) => current.concat(node));
          fitView({ padding: 0.3, duration: 220 });
          await delay(130);
        }
        for (const edge of graph.edges) {
          setEdges((current) => current.concat(edge));
          await delay(60);
        }
        await delay(180);
        dirtyRef.current = true;
        await persist();
        fitView({ padding: 0.2, duration: 320 });
      } catch (error) {
        setSaveState("error");
        setShowProjectPicker(true);
        toast.error("Couldn’t generate the project", "generate", errorDetail(error));
      } finally {
        setIsLoadingProject(false);
        setProjectLoadingLabel("Loading project...");
      }
    },
    [fitView, loadProjectChats, persist, setEdges, setNodes],
  );

  const autoArrangeNodes = useCallback(() => {
    setNodes((current) => layoutGraph(current, snapshotRef.current.edges));
    dirtyRef.current = true;
    window.requestAnimationFrame(() => fitView({ padding: 0.18, duration: 420 }));
  }, [fitView, setNodes]);

  const requestSuggestions = useCallback(
    async (targetNodeId?: string, instruction?: string) => {
      if (!project.id || aiBusy) {
        return;
      }
      setIsSuggesting(true);
      try {
        await persist();
        const result = await suggestChanges({ projectId: project.id, targetNodeId, instruction });
        const centre = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        setGhostPositions(computeGhostPositions(result, snapshotRef.current.nodes, centre));
        setProposal(result);
        setIsInspectorCollapsed(true);
        if (targetNodeId) {
          focusNode(targetNodeId);
        }
        if (result.changes.length === 0) {
          toast.success("No changes to suggest — your canvas looks solid", "suggest");
        } else {
          toast.success(
            `${result.changes.length} suggestion${result.changes.length === 1 ? "" : "s"} ready to review`,
            "suggest",
          );
        }
      } catch (error) {
        setSaveState("error");
        toast.error("Couldn’t reach the AI — try again", "suggest", errorDetail(error));
      } finally {
        setIsSuggesting(false);
      }
    },
    [aiBusy, focusNode, persist, project.id, screenToFlowPosition],
  );

  const createSpecForNode = useCallback(
    async (sourceNodeId: string, instruction?: string) => {
      if (!project.id || aiBusy) {
        return;
      }
      setIsSuggesting(true);
      try {
        // Persist first so the spec is built from the latest saved canvas.
        await persist();
        const spec = await createSpec(project.id, sourceNodeId, instruction);
        const sourceNode = snapshotRef.current.nodes.find((node) => node.id === sourceNodeId);
        const specId = createId("node");
        const timestamp = nowIso();
        const position = sourceNode
          ? { x: sourceNode.position.x + 360, y: sourceNode.position.y + 60 }
          : screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        const specNode: CanvasFlowNode = {
          id: specId,
          type: "contextNode",
          position,
          data: {
            canvasType: "spec",
            title: spec.title,
            fields: { content: spec.content },
            tags: ["spec"],
            updatedAt: timestamp,
          },
        };
        dirtyRef.current = true;
        setNodes((current) => current.concat(specNode));
        if (sourceNode) {
          const edgeId = createId("edge");
          setEdges((current) =>
            current.concat({
              id: edgeId,
              source: specId,
              target: sourceNodeId,
              type: "default",
              label: "specifies",
              data: { relationship: "specifies", updatedAt: timestamp },
            }),
          );
        }
        setActiveNodeIds([specId]);
        setActiveEdgeIds([]);
        setIsInspectorCollapsed(false);
        toast.success("Spec created — hand it to your coding agent", "spec-create");
      } catch (error) {
        setSaveState("error");
        toast.error("Couldn’t create the spec — try again", "spec-create", errorDetail(error));
      } finally {
        setIsSuggesting(false);
      }
    },
    [aiBusy, persist, project.id, screenToFlowPosition, setEdges, setNodes],
  );

  const applyAcceptance = useCallback(
    (changeIds: string[]) => {
      const current = proposal;
      if (!current) {
        return;
      }
      const requested = new Set(changeIds);
      const keyToNodeChange = new Map<string, ProposedChange>();
      for (const change of current.changes) {
        if (change.op === "add_node" && change.nodeKey) {
          keyToNodeChange.set(change.nodeKey, change);
        }
      }
      // Accepting an edge pulls in any still-proposed node it depends on.
      const accepted = new Set(requested);
      for (const change of current.changes) {
        if (change.op === "add_edge" && requested.has(change.id)) {
          for (const ref of [change.sourceRef, change.targetRef]) {
            const dependency = ref ? keyToNodeChange.get(ref) : undefined;
            if (dependency) {
              accepted.add(dependency.id);
            }
          }
        }
      }

      const now = nowIso();
      let nextNodes = snapshotRef.current.nodes.slice();
      for (const change of current.changes) {
        if (change.op === "add_node" && accepted.has(change.id)) {
          nextNodes.push(committedNodeFromChange(change, ghostPositions, now));
        }
      }
      for (const change of current.changes) {
        if (change.op === "update_node" && accepted.has(change.id)) {
          nextNodes = nextNodes.map((node) => {
            if (node.id !== change.nodeId) {
              return node;
            }
            // Accepting the fix resolves the flag — drop impact so it clears immediately.
            const nextData = {
              ...node.data,
              title: change.titleAfter ?? node.data.title,
              fields: { ...node.data.fields, content: change.contentAfter ?? node.data.fields.content },
              updatedAt: now,
            };
            delete nextData.impact;
            return { ...node, data: nextData };
          });
        }
      }

      const committedIds = new Set(nextNodes.map((node) => node.id));
      const keyToId = new Map<string, string>();
      for (const change of current.changes) {
        if (change.op === "add_node" && change.nodeKey) {
          keyToId.set(change.nodeKey, ghostIdFor(change));
        }
      }
      const nextEdges = snapshotRef.current.edges.slice();
      for (const change of current.changes) {
        if (change.op === "add_edge" && accepted.has(change.id)) {
          const source = resolveRef(change.sourceRef, committedIds, keyToId);
          const target = resolveRef(change.targetRef, committedIds, keyToId);
          if (source && target && source !== target) {
            const relationship = change.relationship ?? "references";
            nextEdges.push({
              id: createId("edge"),
              type: "default",
              source,
              target,
              label: relationship,
              data: { relationship, updatedAt: now },
            });
          }
        }
      }

      setNodes(nextNodes);
      setEdges(nextEdges);
      dirtyRef.current = true;

      const remaining = current.changes.filter((change) => !accepted.has(change.id));
      setProposal(remaining.length ? { ...current, changes: remaining } : null);
    },
    [ghostPositions, proposal, setEdges, setNodes],
  );

  const rejectChange = useCallback((changeId: string) => {
    setProposal((current) => {
      if (!current) {
        return current;
      }
      const remaining = current.changes.filter((change) => change.id !== changeId);
      return remaining.length ? { ...current, changes: remaining } : null;
    });
  }, []);

  const focusChange = useCallback(
    (change: ProposedChange) => {
      if (change.op === "update_node" && change.nodeId) {
        focusNode(change.nodeId);
        return;
      }
      if (change.op === "add_node" && change.nodeKey) {
        const position = ghostPositions[change.nodeKey];
        if (position) {
          setCenter(position.x + 140, position.y + 80, { zoom: 1, duration: 300 });
        }
        return;
      }
      if (change.op === "add_edge" && change.sourceRef) {
        focusNode(change.sourceRef);
      }
    },
    [focusNode, ghostPositions, setCenter],
  );

  const acceptChange = useCallback(
    (changeId: string) => {
      applyAcceptance([changeId]);
      toast.success("Suggestion applied to the canvas", "suggest-apply");
    },
    [applyAcceptance],
  );
  const acceptAllChanges = useCallback(() => {
    if (proposal) {
      const count = proposal.changes.length;
      applyAcceptance(proposal.changes.map((change) => change.id));
      toast.success(`${count} suggestion${count === 1 ? "" : "s"} applied to the canvas`, "suggest-apply");
    }
  }, [applyAcceptance, proposal]);
  const dismissProposal = useCallback(() => setProposal(null), []);

  const handleRenameProject = useCallback(
    async (targetProjectId: string, name: string) => {
      try {
        const updated = await renameProject(targetProjectId, name);
        setProjects((prev) => prev.map((p) => (p.id === targetProjectId ? updated : p)));
        if (project.id === targetProjectId) setProject(updated);
      } catch {
        // silently ignore — list stays unchanged
      }
    },
    [project.id],
  );

  const handleDeleteProject = useCallback(async (targetProjectId: string) => {
    try {
      await deleteProject(targetProjectId);
      setProjects((prev) => prev.filter((p) => p.id !== targetProjectId));
    } catch {
      // silently ignore — list stays unchanged
    }
  }, []);

  const handleBackToProjects = useCallback(async () => {
    if (project.id) await persist();
    const result = await listProjects();
    setProjects(result.projects);
    setShowProjectPicker(true);
    navigateToProjects();
  }, [persist, project.id]);

  const handleSelectionChange = useCallback(
    ({ nodes: selected, edges: selectedEdges }: { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] }) => {
      setActiveNodeIds(selected.map((n) => n.id));
      setActiveEdgeIds(selectedEdges.map((e) => e.id));
    },
    [],
  );

  const handleLoadDemo = useCallback(async () => {
    const loaded = await listProjects();
    const snapshot = await loadCanvas(loaded.projects[0].id);
    setProject(snapshot.project);
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    await loadProjectChats(snapshot.project.id);
    navigateToCanvas(snapshot.project.id);
    window.requestAnimationFrame(() => fitView({ padding: 0.18 }));
  }, [fitView, loadProjectChats, setEdges, setNodes]);

  if (isBooting) {
    return (
      <Suspense fallback={<main className="app-loading" aria-label="Loading AI Mindmap" />}>
        <AppLoading />
      </Suspense>
    );
  }

  if (showProjectPicker) {
    return (
      <ProjectCarousel
        projects={projects}
        isLoading={isLoadingProject}
        loadingLabel={projectLoadingLabel}
        onSelectProject={(id) => void handleSelectProject(id)}
        onCreateProject={(templateId) => void handleCreateProject(templateId)}
        onGenerateProject={(prompt) => void handleGenerateProject(prompt)}
        onRenameProject={(id, name) => void handleRenameProject(id, name)}
        onDeleteProject={(id) => void handleDeleteProject(id)}
      />
    );
  }

  return (
    <main
      className={[
        "canvas-shell",
        isChatCollapsed ? "is-chat-collapsed" : "",
        !selectedNode && !selectedEdge ? "is-inspector-hidden" : "",
        selectedNode && isInspectorCollapsed ? "is-inspector-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="topbar">
        <div>
          <ProjectSwitcher
            projects={projects}
            currentId={project.id}
            currentName={project.name}
            onSelect={(id) => void handleSelectProject(id)}
          />
          {project.description ? <p>{project.description}</p> : null}
        </div>
        <div className={`save-state save-state-${saveState}`}>
          {saveState === "saving" || saveState === "loading" ? (
            <Spinner size={11} />
          ) : (
            <Circle size={8} fill="currentColor" />
          )}
          <span>
            {saveState === "loading"
              ? "Loading…"
              : saveState === "saving"
                ? "Saving…"
                : saveState === "error"
                  ? "Couldn’t save"
                  : savedLabel}
          </span>
          <Button
            icon={isChatCollapsed ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            variant="ghost"
            onClick={toggleFocusMode}
            title={isChatCollapsed ? "Exit focus mode" : "Focus mode — hide side panels"}
          >
            Focus
          </Button>
          <Button icon={<Plug size={14} />} variant="ghost" onClick={() => setIsConnectOpen(true)}>
            Connect
          </Button>
          <Button icon={<Code2 size={14} />} variant="ghost" onClick={() => setIsHandoffOpen(true)}>
            Handoff
          </Button>
          <Button icon={<LayoutGrid size={14} />} variant="ghost" onClick={() => void handleBackToProjects()}>
            Projects
          </Button>
        </div>
      </header>

      <section className="flow-region">
        <GalaxyBackground />
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={connectNodes}
          onReconnect={reconnectEdgeEndpoint}
          isValidConnection={isValidConnection}
          onSelectionChange={handleSelectionChange}
          onNodeDoubleClick={(_, node) => focusNode(node.id)}
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          deleteKeyCode={null}
          multiSelectionKeyCode={["Meta", "Shift"]}
        >
          <Controls showInteractive={false} />
          <MiniMap
            position="top-right"
            pannable
            zoomable
            nodeColor={miniMapNodeColor}
            nodeStrokeWidth={2}
            maskColor="rgb(6 11 24 / 72%)"
            style={{ background: "rgb(10 16 32 / 88%)" }}
          />
        </ReactFlow>
        {displayNodes.length === 0 && !isLoadingProject ? (
          <div className="canvas-empty-hint">
            <p>This canvas is empty.</p>
            <span>Start mapping your project, or generate a plan with AI.</span>
            <div className="canvas-empty-actions">
              <button type="button" onClick={() => handleAddNode("project_contract")}>
                Add Project Contract
              </button>
              <button type="button" onClick={() => handleAddNode("requirement")}>
                Add Requirement
              </button>
              <button type="button" onClick={() => void requestSuggestions()} disabled={aiBusy}>
                Ask AI for ideas
              </button>
            </div>
          </div>
        ) : null}
        {nodes.length > 0 ? (
          <div className="canvas-overlay-controls">
            <CanvasTypeFilter active={typeFilter} onToggle={toggleTypeFilter} onClear={clearTypeFilter} />
          </div>
        ) : null}
      </section>

      {selectedNode && !isInspectorCollapsed ? (
        <CanvasInspector
          key={selectedNode.id}
          projectId={project.id}
          activeNode={selectedNode}
          saveState={saveState}
          isSuggesting={isSuggesting}
          aiBusy={aiBusy}
          projectName={project.name}
          onSaveNode={saveNodeVersion}
          onChatAboutNode={chatAboutNode}
          onRequestSuggestions={(nodeId, instruction) => void requestSuggestions(nodeId, instruction)}
          onCreateSpec={(nodeId, instruction) => void createSpecForNode(nodeId, instruction)}
          onCollapse={() => setIsInspectorCollapsed(true)}
        />
      ) : null}

      {selectedNode && isInspectorCollapsed ? (
        <aside className="inspector-rail" aria-label="Inspector collapsed">
          <button type="button" onClick={() => setIsInspectorCollapsed(false)} aria-label="Open inspector" title="Open inspector">
            <PanelRightOpen size={18} />
          </button>
        </aside>
      ) : null}

      {!selectedNode && selectedEdge ? (
        <EdgeInspector
          edge={selectedEdge}
          nodes={nodes}
          onUpdateLabel={updateEdgeLabel}
          onCollapse={() => setActiveEdgeIds([])}
        />
      ) : null}

      <CanvasAiPanel
        chats={chats}
        activeChatId={activeChatId}
        messages={messages}
        question={question}
        isSending={isSending}
        aiBusy={aiBusy}
        isCreatingChat={isCreatingChat}
        loadingChatId={loadingChatId}
        onQuestionChange={setQuestion}
        onNewChat={startNewChat}
        onSelectChat={selectChat}
        onDeleteChat={removeChat}
        onSendMessage={runAnalysis}
        onHighlightCitations={highlightCitations}
        onFocusNode={focusNode}
        isCollapsed={isChatCollapsed}
        onToggleCollapsed={() => setIsChatCollapsed((current) => !current)}
      />

      <CanvasToolbar
        onAddNode={handleAddNode}
        onFitView={handleFitView}
        onAutoArrange={autoArrangeNodes}
        onExportImage={exportCanvasImage}
        onExportMarkdown={exportCanvasMarkdown}
        onCopyMarkdown={() => void copyCanvasMarkdown()}
        onExportJson={exportCanvasJson}
        onImportJson={importCanvasJson}
        onSuggest={() => void requestSuggestions()}
        aiBusy={aiBusy}
        onSave={() => void handleManualSave()}
        onLoadDemo={() => void handleLoadDemo()}
        onDeleteItems={deleteActiveItems}
        activeItemCount={activeNodeIds.length + activeEdgeIds.length}
      />

      {proposal || isSuggesting ? (
        <SuggestionReview
          proposal={proposal}
          isLoading={isSuggesting && !proposal}
          onAccept={acceptChange}
          onReject={rejectChange}
          onAcceptAll={acceptAllChanges}
          onDismiss={dismissProposal}
          onFocus={focusChange}
        />
      ) : null}

      {isCommandOpen ? (
        <Suspense fallback={null}>
          <CommandPalette
            nodes={nodes}
            onSelect={focusNode}
            onHighlight={highlightCitations}
            onClose={() => setIsCommandOpen(false)}
          />
        </Suspense>
      ) : null}

      {isShortcutsOpen ? (
        <Suspense fallback={null}>
          <ShortcutsOverlay onClose={() => setIsShortcutsOpen(false)} />
        </Suspense>
      ) : null}

      {isConnectOpen ? (
        <Suspense fallback={null}>
          <ConnectAgentModal project={project} onClose={() => setIsConnectOpen(false)} />
        </Suspense>
      ) : null}

      {isHandoffOpen ? (
        <Suspense fallback={null}>
          <DeveloperHandoffPanel
            project={project}
            nodes={nodes}
            edges={edges}
            onClose={() => setIsHandoffOpen(false)}
          />
        </Suspense>
      ) : null}

    </main>
  );
}

const MINIMAP_NODE_COLORS: Record<CanvasNodeType, string> = {
  project_contract: "#4a9eff",
  requirement: "#3fc46b",
  source_snapshot: "#22d3ee",
  link: "#f0a429",
  image: "#e879b9",
  note: "#b78cff",
  spec: "#6d78ff",
};

function miniMapNodeColor(node: CanvasFlowNode) {
  return MINIMAP_NODE_COLORS[node.data.canvasType] ?? "#6aa6f8";
}

const GHOST_DX = 360;
const GHOST_DY = 180;

function isProposedId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith("proposed_");
}

function ghostIdFor(change: ProposedChange) {
  return `proposed_${change.id}`;
}

function resolveRef(
  ref: string | undefined,
  committedIds: Set<string>,
  keyToId: Map<string, string>,
): string | null {
  if (!ref) {
    return null;
  }
  if (committedIds.has(ref)) {
    return ref;
  }
  const mapped = keyToId.get(ref);
  return mapped && committedIds.has(mapped) ? mapped : null;
}

function committedNodeFromChange(
  change: ProposedChange,
  positions: Record<string, { x: number; y: number }>,
  timestamp: string,
): CanvasFlowNode {
  return {
    id: ghostIdFor(change),
    type: "contextNode",
    position: positions[change.nodeKey ?? ""] ?? { x: 0, y: 0 },
    data: {
      canvasType: change.nodeType ?? "requirement",
      title: change.title ?? "Untitled",
      fields: { content: change.content ?? "" },
      tags: change.tags ?? [],
      updatedAt: timestamp,
    },
  };
}

function computeGhostPositions(
  proposal: SuggestionResponse,
  nodes: CanvasFlowNode[],
  centre: { x: number; y: number },
): Record<string, { x: number; y: number }> {
  const byAnchor = new Map<string, ProposedChange[]>();
  for (const change of proposal.changes) {
    if (change.op !== "add_node" || !change.nodeKey) {
      continue;
    }
    const anchor = change.anchorNodeId ?? "__none__";
    byAnchor.set(anchor, [...(byAnchor.get(anchor) ?? []), change]);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  for (const [anchorId, group] of byAnchor) {
    const anchorNode = nodes.find((node) => node.id === anchorId);
    const baseX = anchorNode ? anchorNode.position.x + GHOST_DX : centre.x;
    const baseY = anchorNode ? anchorNode.position.y : centre.y;
    group.forEach((change, index) => {
      positions[change.nodeKey as string] = {
        x: baseX,
        y: baseY + (index - (group.length - 1) / 2) * GHOST_DY,
      };
    });
  }
  return positions;
}

type ProposalView = {
  proposedNodes: CanvasFlowNode[];
  proposedEdges: CanvasFlowEdge[];
  updateNodeIds: Set<string>;
  updateRationale: Map<string, string>;
};

function buildProposalView(
  proposal: SuggestionResponse | null,
  positions: Record<string, { x: number; y: number }>,
  committedNodeIds: Set<string>,
): ProposalView {
  const proposedNodes: CanvasFlowNode[] = [];
  const proposedEdges: CanvasFlowEdge[] = [];
  const updateNodeIds = new Set<string>();
  const updateRationale = new Map<string, string>();
  if (!proposal) {
    return { proposedNodes, proposedEdges, updateNodeIds, updateRationale };
  }

  const keyToId = new Map<string, string>();
  for (const change of proposal.changes) {
    if (change.op === "add_node" && change.nodeKey) {
      keyToId.set(change.nodeKey, ghostIdFor(change));
    }
  }
  const ghostIds = new Set([...committedNodeIds, ...keyToId.values()]);

  for (const change of proposal.changes) {
    if (change.op === "add_node") {
      proposedNodes.push({
        id: ghostIdFor(change),
        type: "contextNode",
        position: positions[change.nodeKey ?? ""] ?? { x: 0, y: 0 },
        draggable: false,
        selectable: false,
        data: {
          canvasType: change.nodeType ?? "requirement",
          title: change.title ?? "Untitled",
          fields: { content: change.content ?? "" },
          tags: change.tags ?? [],
          updatedAt: "",
          proposed: "add",
          rationale: change.rationale,
        },
      });
    } else if (change.op === "update_node" && change.nodeId) {
      updateNodeIds.add(change.nodeId);
      updateRationale.set(change.nodeId, change.rationale);
    }
  }

  for (const change of proposal.changes) {
    if (change.op !== "add_edge") {
      continue;
    }
    const source = resolveRef(change.sourceRef, ghostIds, keyToId);
    const target = resolveRef(change.targetRef, ghostIds, keyToId);
    if (!source || !target || source === target) {
      continue;
    }
    proposedEdges.push({
      id: ghostIdFor(change),
      type: "default",
      source,
      target,
      label: change.relationship ?? "references",
      selectable: false,
      deletable: false,
      animated: true,
      className: "proposed-edge",
      data: { relationship: change.relationship ?? "references", updatedAt: "" },
    });
  }

  return { proposedNodes, proposedEdges, updateNodeIds, updateRationale };
}

function canvasPath(projectId: string) {
  return `/canvas/${encodeURIComponent(projectId)}`;
}

function parseCanvasId(pathname: string): string | null {
  const match = pathname.match(/^\/canvas\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function navigateToCanvas(projectId: string) {
  const path = canvasPath(projectId);
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
  }
}

function navigateToProjects() {
  if (window.location.pathname !== "/") {
    window.history.pushState(null, "", "/");
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function nodeChangeAffectsPersistence(change: NodeChange<CanvasFlowNode>) {
  return change.type !== "select" && change.type !== "dimensions";
}

function edgeChangeAffectsPersistence(change: EdgeChange<CanvasFlowEdge>) {
  return change.type !== "select";
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
