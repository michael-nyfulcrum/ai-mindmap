import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Circle, Code2, LayoutGrid, PanelRightOpen, Plug, Sparkles } from "lucide-react";
import { CanvasAiPanel } from "./CanvasAiPanel";
import { ConnectAgentModal } from "./ConnectAgentModal";
import { DeveloperHandoffPanel } from "./DeveloperHandoffPanel";
import { CanvasInspector } from "./CanvasInspector";
import { CanvasToolbar } from "./CanvasToolbar";
import { GalaxyBackground } from "./GalaxyBackground";
import { ProjectCarousel } from "./ProjectCarousel";
import {
  createChat,
  createProject,
  deleteChat,
  deleteProject,
  listChats,
  listProjects,
  loadCanvas,
  loadChat,
  renameProject,
  saveCanvas,
  sendChatMessage,
  uploadAsset,
} from "../api/canvasApi";
import {
  defaultFieldsForType,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasNodeData,
  type CanvasNodeType,
  type CanvasProject,
  type ChatMessage,
  type ChatThread,
} from "./canvasTypes";
import { ContextNode } from "./nodes/ContextNode";
import { Button } from "../shared/ui/Button";
import { createId } from "../shared/ids";
import { nowIso } from "../shared/time";
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
  const [isBooting, setIsBooting] = useState(true);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const { fitView, screenToFlowPosition, getViewport, setCenter } = useReactFlow();
  const projectId = project.id;
  const snapshotRef = useRef({ project, nodes, edges });
  const getViewportRef = useRef(getViewport);
  const dirtyRef = useRef(false);
  const handleSelectProjectRef = useRef<(id: string) => void>(() => {});

  const activeNodes = useMemo(() => nodes.filter((node) => activeNodeIds.includes(node.id)), [activeNodeIds, nodes]);
  const selectedNode = activeNodes.length === 1 ? activeNodes[0] : null;
  // Render every edge as a curved bezier, including projects saved with the older step style.
  const displayEdges = useMemo(
    () => edges.map((edge) => (edge.type === "default" ? edge : { ...edge, type: "default" })),
    [edges],
  );

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
        // show empty state — user can create a new project
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
    async (options?: { nodes?: CanvasFlowNode[]; commitMessage?: string }) => {
      const {
        project: currentProject,
        nodes: snapshotNodes,
        edges: currentEdges,
      } = snapshotRef.current;
      const currentNodes = options?.nodes ?? snapshotNodes;
      if (!currentProject.id) {
        return;
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
      } catch {
        dirtyRef.current = true;
        setSaveState("error");
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
      if (changes.some(nodeChangeAffectsPersistence)) {
        dirtyRef.current = true;
      }
      onNodesChangeBase(changes);
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
      } catch {
        setSaveState("error");
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
      dirtyRef.current = true;
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: createId("edge"),
            type: "default",
            label: "references",
            data: { relationship: "references", updatedAt: timestamp },
          },
          current,
        ),
      );
    },
    [setEdges],
  );

  const saveNodeVersion = useCallback(
    async (nodeId: string, data: CanvasNodeData, commitMessage: string) => {
      const nextNodes = snapshotRef.current.nodes.map((node) => (node.id === nodeId ? { ...node, data } : node));
      setNodes(nextNodes);
      await persist({ nodes: nextNodes, commitMessage: commitMessage || undefined });
    },
    [persist, setNodes],
  );

  const deleteActiveItems = useCallback(() => {
    const nodeIds = new Set(activeNodeIds);
    const edgeIds = new Set(activeEdgeIds);
    dirtyRef.current = true;
    setNodes((current) => current.filter((node) => !nodeIds.has(node.id)));
    setEdges((current) =>
      current.filter((edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target)),
    );
    setActiveNodeIds([]);
    setActiveEdgeIds([]);
    setIsInspectorCollapsed(false);
  }, [activeEdgeIds, activeNodeIds, setEdges, setNodes]);

  const sendCanvasMessage = useCallback(async (content: string) => {
    if (!project.id) {
      return;
    }

    if (!content.trim()) {
      return;
    }

    await persist();
    let chatId = activeChatId;
    if (!chatId) {
      const created = await createChat(project.id);
      chatId = created.thread.id;
      setChats((current) => [created.thread, ...current]);
      setActiveChatId(chatId);
      setMessages([]);
    }

    const messageContent = content.trim();
    setIsSending(true);
    try {
      const result = await sendChatMessage({ projectId: project.id, chatId, content: messageContent });
      setChats((current) => [result.thread, ...current.filter((chat) => chat.id !== result.thread.id)]);
      setMessages(result.messages);
    } catch {
      setQuestion(messageContent);
      setSaveState("error");
    } finally {
      setIsSending(false);
    }
  }, [activeChatId, persist, project.id]);

  const runAnalysis = useCallback(async () => {
    const content = question.trim();
    setQuestion("");
    await sendCanvasMessage(content);
  }, [question, sendCanvasMessage]);

  const requestImpactPlan = useCallback(
    (node: CanvasFlowNode) => {
      const impact = node.data.impact;
      if (!impact) {
        return;
      }
      setIsChatCollapsed(false);
      setQuestion("");
      void sendCanvasMessage(
        [
          `Draft an update plan for the flagged node "${node.data.title}" (${node.id}).`,
          `Impact status: ${impact.status}.`,
          `Impact reason: ${impact.reason}`,
          `Source node: ${impact.sourceNodeId}. Source version: ${impact.sourceVersionId}.`,
          "Use only the saved canvas. Include why it was flagged, what needs review, suggested requirement edits, implementation implications, tests or verification, and open questions. Do not change canvas nodes automatically.",
        ].join("\n"),
      );
    },
    [sendCanvasMessage],
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
        !selectedNode ? "is-inspector-hidden" : "",
        selectedNode && isInspectorCollapsed ? "is-inspector-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="topbar">
        <div>
          <h1>
            <Sparkles size={18} />
            {project.name}
          </h1>
          {project.description ? <p>{project.description}</p> : null}
        </div>
        <div className="save-state">
          <Circle size={8} fill="currentColor" />
          <span>
            {saveState === "loading"
              ? "Loading…"
              : saveState === "saving"
                ? "Saving…"
                : saveState === "error"
                  ? "Couldn’t save"
                  : "All saved"}
          </span>
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
          nodes={nodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={connectNodes}
          onSelectionChange={handleSelectionChange}
          fitView
          deleteKeyCode={null}
          multiSelectionKeyCode={["Meta", "Shift"]}
        >
          <Controls showInteractive={false} />
        </ReactFlow>
      </section>

      {selectedNode && !isInspectorCollapsed ? (
        <CanvasInspector
          key={selectedNode.id}
          projectId={project.id}
          activeNode={selectedNode}
          saveState={saveState}
          onSaveNode={saveNodeVersion}
          onRequestImpactPlan={requestImpactPlan}
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

      <CanvasAiPanel
        chats={chats}
        activeChatId={activeChatId}
        messages={messages}
        question={question}
        isSending={isSending}
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
        onFitView={() => fitView({ padding: 0.18 })}
        onSave={() => void persist()}
        onLoadDemo={() => void handleLoadDemo()}
        onDeleteItems={deleteActiveItems}
        activeItemCount={activeNodeIds.length + activeEdgeIds.length}
      />

      {isConnectOpen ? (
        <ConnectAgentModal project={project} onClose={() => setIsConnectOpen(false)} />
      ) : null}

      {isHandoffOpen ? (
        <DeveloperHandoffPanel
          project={project}
          nodes={nodes}
          edges={edges}
          onClose={() => setIsHandoffOpen(false)}
        />
      ) : null}
    </main>
  );
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
