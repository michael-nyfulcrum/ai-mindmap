import type { AnalysisResponse, CanvasProject, CanvasSnapshot, ChatMessage, ChatThread, ContractChangeVersion, SuggestionResponse } from "../canvas/canvasTypes";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

type CreateProjectInput = {
  name: string;
  description?: string;
  viewport?: CanvasProject["viewport"];
  nodes?: CanvasSnapshot["nodes"];
  edges?: CanvasSnapshot["edges"];
};

/**
 * Build an Error that prefers the server-provided `detail` (FastAPI returns
 * useful messages like "Upload is too large"), falling back to a generic
 * message when the response has no readable detail.
 */
async function readError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = await response.json();
    if (body && typeof body.detail === "string" && body.detail.trim()) {
      return new Error(body.detail);
    }
  } catch {
    // Non-JSON or empty body — fall back to the generic message.
  }
  return new Error(fallback);
}

export async function listProjects() {
  const response = await fetch(`${API_BASE_URL}/api/projects`);
  if (!response.ok) {
    throw await readError(response, "Failed to load projects");
  }

  return (await response.json()) as { projects: CanvasSnapshot["project"][] };
}

export async function loadCanvas(projectId: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/canvas`);
  if (!response.ok) {
    throw await readError(response, "Failed to load canvas");
  }

  return (await response.json()) as CanvasSnapshot;
}

export async function createProject(input: string | CreateProjectInput) {
  const payload = typeof input === "string" ? { name: input } : input;
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await readError(response, "Failed to create project");
  }

  return (await response.json()) as CanvasSnapshot;
}

export async function generateProject(prompt: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    throw await readError(response, "Failed to generate project");
  }

  return (await response.json()) as {
    projectName: string;
    projectDescription: string;
    nodes: CanvasSnapshot["nodes"];
    edges: CanvasSnapshot["edges"];
  };
}

export async function renameProject(projectId: string, name: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw await readError(response, "Failed to rename project");
  }

  return (await response.json()) as CanvasProject;
}

export async function deleteProject(projectId: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw await readError(response, "Failed to delete project");
  }
}

export async function saveCanvas(snapshot: CanvasSnapshot, commitMessage?: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${snapshot.project.id}/canvas`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(commitMessage ? { ...snapshot, commitMessage } : snapshot),
  });
  if (!response.ok) {
    throw await readError(response, "Failed to save canvas");
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
    throw await readError(response, "Failed to analyze canvas");
  }

  return (await response.json()) as AnalysisResponse;
}

export async function suggestChanges(input: { projectId: string; targetNodeId?: string; instruction?: string }) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${input.projectId}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetNodeId: input.targetNodeId ?? null, instruction: input.instruction ?? null }),
  });
  if (!response.ok) {
    throw await readError(response, "Failed to get suggestions");
  }

  return (await response.json()) as SuggestionResponse;
}

export async function listNodeVersions(input: { projectId: string; nodeId: string }) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${input.projectId}/nodes/${input.nodeId}/versions`);
  if (!response.ok) {
    throw await readError(response, "Failed to load version history");
  }

  return (await response.json()) as { versions: ContractChangeVersion[] };
}

export async function listChats(projectId: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/chats`);
  if (!response.ok) {
    throw await readError(response, "Failed to load chats");
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
    throw await readError(response, "Failed to create chat");
  }

  return (await response.json()) as { thread: ChatThread; messages: ChatMessage[] };
}

export async function loadChat(projectId: string, chatId: string) {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/chats/${chatId}`);
  if (!response.ok) {
    throw await readError(response, "Failed to load chat");
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
    throw await readError(response, "Failed to send chat message");
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
    throw await readError(response, "Failed to delete chat");
  }
}

export async function uploadAsset(input: { projectId: string; filename: string; contentType: string; dataUrl: string }) {
  const response = await fetch(`${API_BASE_URL}/api/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await readError(response, "Failed to upload asset");
  }

  const upload = (await response.json()) as {
    id: string;
    projectId: string;
    filename: string;
    contentType: string;
    url: string;
    createdAt: string;
  };
  return { ...upload, url: toPublicUrl(upload.url) };
}

function toPublicUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}
