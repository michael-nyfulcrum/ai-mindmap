import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
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
import { Circle, PanelRightOpen, Plus, Sparkles } from "lucide-react";
import { CanvasAiPanel } from "./CanvasAiPanel";
import { CanvasInspector } from "./CanvasInspector";
import { CanvasToolbar } from "./CanvasToolbar";
import { GalaxyBackground } from "./GalaxyBackground";
import { createChat, createProject, deleteChat, listChats, listProjects, loadCanvas, loadChat, saveCanvas, sendChatMessage, uploadAsset } from "../api/canvasApi";
import { defaultFieldsForType, type CanvasFlowEdge, type CanvasFlowNode, type CanvasNodeData, type CanvasNodeType, type CanvasProject, type ChatMessage, type ChatThread } from "./canvasTypes";
import { ContextNode } from "./nodes/ContextNode";
import { Button } from "../shared/ui/Button";
import { createId } from "../shared/ids";
import { nowIso } from "../shared/time";

const nodeTypes = { contextNode: ContextNode };
const AppLoading = lazy(() => import("../app/AppLoading").then((module) => ({ default: module.AppLoading })));
const MIN_LOADING_MS = 4200;

export function CanvasPage() {
  const [project, setProject] = useState<CanvasProject>({
    id: "",
    name: "Context Canvas",
    description: "Loading project memory...",
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
  const { fitView, screenToFlowPosition, getViewport, setCenter } = useReactFlow();
  const projectId = project.id;
  const snapshotRef = useRef({ project, nodes, edges });
  const getViewportRef = useRef(getViewport);
  const dirtyRef = useRef(false);

  const activeNodes = useMemo(() => nodes.filter((node) => activeNodeIds.includes(node.id)), [activeNodeIds, nodes]);
  const selectedNode = activeNodes.length === 1 ? activeNodes[0] : null;

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

    async function loadInitialProject() {
      const minimumLoading = delay(MIN_LOADING_MS);
      try {
        setSaveState("loading");
        const projects = await listProjects();
        const firstProject = projects.projects[0] ?? (await createProject("Untitled Canvas")).project;
        const snapshot = await loadCanvas(firstProject.id);

        if (cancelled) {
          return;
        }

        setProject(snapshot.project);
        setNodes(snapshot.nodes);
        setEdges(snapshot.edges);
        await loadProjectChats(snapshot.project.id);
        setSaveState("saved");
        await minimumLoading;
        if (cancelled) {
          return;
        }
        setIsBooting(false);
        window.requestAnimationFrame(() => fitView({ padding: 0.18 }));
      } catch {
        await minimumLoading;
        if (!cancelled) {
          setSaveState("error");
          setIsBooting(false);
        }
      }
    }

    void loadInitialProject();
    return () => {
      cancelled = true;
    };
  }, [fitView, loadProjectChats, setEdges, setNodes]);

  const persist = useCallback(async () => {
    const {
      project: currentProject,
      nodes: currentNodes,
      edges: currentEdges,
    } = snapshotRef.current;
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
      const saved = await saveCanvas({ project: updatedProject, nodes: currentNodes, edges: currentEdges });
      setProject(saved.project);
      setSaveState("saved");
    } catch {
      dirtyRef.current = true;
      setSaveState("error");
    }
  }, []);

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
            type: "smoothstep",
            label: "references",
            data: { relationship: "references", updatedAt: timestamp },
          },
          current,
        ),
      );
    },
    [setEdges],
  );

  const updateNode = useCallback(
    (nodeId: string, data: CanvasNodeData) => {
      dirtyRef.current = true;
      setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, data } : node)));
    },
    [setNodes],
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

  const runAnalysis = useCallback(async () => {
    if (!project.id) {
      return;
    }

    if (!question.trim()) {
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

    const content = question.trim();
    setQuestion("");
    setIsSending(true);
    try {
      const result = await sendChatMessage({ projectId: project.id, chatId, content });
      setChats((current) => [result.thread, ...current.filter((chat) => chat.id !== result.thread.id)]);
      setMessages(result.messages);
    } catch {
      setQuestion(content);
      setSaveState("error");
    } finally {
      setIsSending(false);
    }
  }, [activeChatId, persist, project.id, question]);

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

  const newProject = useCallback(async () => {
    const name = `Canvas ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const snapshot = await createProject(name);
    setProject(snapshot.project);
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setActiveNodeIds([]);
    setActiveEdgeIds([]);
    setIsInspectorCollapsed(false);
    await loadProjectChats(snapshot.project.id);
    window.requestAnimationFrame(() => fitView({ padding: 0.18 }));
  }, [fitView, loadProjectChats, setEdges, setNodes]);

  if (isBooting) {
    return (
      <Suspense fallback={<main className="app-loading" aria-label="Loading Context Canvas" />}>
        <AppLoading />
      </Suspense>
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
          <p>{project.description}</p>
        </div>
        <div className="save-state">
          <Circle size={10} fill="currentColor" />
          <span>{saveState === "loading" ? "Loading" : saveState === "saving" ? "Saving" : saveState === "error" ? "Save error" : "Saved to DB"}</span>
          <Button icon={<Plus size={14} />} variant="ghost" onClick={() => void newProject()}>
            New
          </Button>
        </div>
      </header>

      <section className="flow-region">
        <GalaxyBackground />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={connectNodes}
          onSelectionChange={({ nodes: activeNodes, edges: activeEdges }) => {
            setActiveNodeIds(activeNodes.map((node) => node.id));
            setActiveEdgeIds(activeEdges.map((edge) => edge.id));
          }}
          fitView
          deleteKeyCode={null}
          multiSelectionKeyCode={["Meta", "Shift"]}
        >
          <Background gap={34} size={1} color="rgb(255 255 255 / 20%)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </section>

      {selectedNode && !isInspectorCollapsed ? (
        <CanvasInspector
          activeNode={selectedNode}
          allEdges={edges}
          onUpdateNode={updateNode}
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
        onLoadDemo={() => {
          void listProjects()
            .then((projects) => loadCanvas(projects.projects[0].id))
            .then((snapshot) => {
              setProject(snapshot.project);
              setNodes(snapshot.nodes);
              setEdges(snapshot.edges);
              void loadProjectChats(snapshot.project.id);
              window.requestAnimationFrame(() => fitView({ padding: 0.18 }));
            });
        }}
        onDeleteItems={deleteActiveItems}
        activeItemCount={activeNodeIds.length + activeEdgeIds.length}
      />
    </main>
  );
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
