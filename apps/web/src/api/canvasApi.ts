import type { AnalysisResponse, CanvasSnapshot, ChatMessage, ChatThread, ContractChangeVersion } from "../canvas/canvasTypes";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787";

export async function listProjects() {
  const response = await fetch(`${API_BASE_URL}/api/projects`);
  if (!response.ok) {
    throw new Error("Failed to load projects");
  }

  return (await response.json()) as { projects: CanvasSnapshot["project"][] };
}

export async function loadCanvas(projectId: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/canvas`);
  if (!response.ok) {
    throw new Error("Failed to load canvas");
  }

  return (await response.json()) as CanvasSnapshot;
}

export async function createProject(name: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error("Failed to create project");
  }

  return (await response.json()) as CanvasSnapshot;
}

export async function saveCanvas(snapshot: CanvasSnapshot) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${snapshot.project.id}/canvas`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) {
    throw new Error("Failed to save canvas");
  }

  return (await response.json()) as CanvasSnapshot;
}

export async function analyzeCanvas(input: { projectId: string; question: string }) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${input.projectId}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: input.question }),
  });
  if (!response.ok) {
    throw new Error("Failed to analyze canvas");
  }

  return (await response.json()) as AnalysisResponse;
}

export async function listNodeVersions(input: { projectId: string; nodeId: string }) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${input.projectId}/nodes/${input.nodeId}/versions`);
  if (!response.ok) {
    throw new Error("Failed to load version history");
  }

  return (await response.json()) as { versions: ContractChangeVersion[] };
}

export async function listChats(projectId: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/chats`);
  if (!response.ok) {
    throw new Error("Failed to load chats");
  }

  return (await response.json()) as { chats: ChatThread[] };
}

export async function createChat(projectId: string, title = "New chat") {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error("Failed to create chat");
  }

  return (await response.json()) as { thread: ChatThread; messages: ChatMessage[] };
}

export async function loadChat(projectId: string, chatId: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/chats/${chatId}`);
  if (!response.ok) {
    throw new Error("Failed to load chat");
  }

  return (await response.json()) as { thread: ChatThread; messages: ChatMessage[] };
}

export async function sendChatMessage(input: { projectId: string; chatId: string; content: string }) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${input.projectId}/chats/${input.chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: input.content }),
  });
  if (!response.ok) {
    throw new Error("Failed to send chat message");
  }

  return (await response.json()) as {
    thread: ChatThread;
    messages: ChatMessage[];
    analysis: AnalysisResponse;
  };
}

export async function deleteChat(projectId: string, chatId: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/chats/${chatId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete chat");
  }
}

export async function uploadAsset(input: { projectId: string; filename: string; contentType: string; dataUrl: string }) {
  const response = await fetch(`${API_BASE_URL}/api/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to upload asset");
  }

  const upload = (await response.json()) as {
    id: string;
    projectId: string;
    filename: string;
    contentType: string;
    url: string;
    createdAt: string;
  };
  return { ...upload, url: `${API_BASE_URL}${upload.url}` };
}
