import { lazy, memo, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Highlighter, MessageSquareText, PanelLeftClose, PanelLeftOpen, Plus, Send, Trash2 } from "lucide-react";
import type { ChatMessage, ChatThread } from "./canvasTypes";
import { Button } from "../shared/ui/Button";
import { Textarea } from "../shared/ui/Textarea";

const ChatThinking = lazy(() => import("./ChatThinking").then((module) => ({ default: module.ChatThinking })));

type CanvasAiPanelProps = {
  chats: ChatThread[];
  activeChatId: string | null;
  messages: ChatMessage[];
  question: string;
  isSending: boolean;
  isCreatingChat: boolean;
  loadingChatId: string | null;
  onQuestionChange: (question: string) => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onSendMessage: () => void;
  onHighlightCitations: (nodeIds: string[]) => void;
  onFocusNode: (nodeId: string) => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
};

export const CanvasAiPanel = memo(function CanvasAiPanel({
  chats,
  activeChatId,
  messages,
  question,
  isSending,
  isCreatingChat,
  loadingChatId,
  onQuestionChange,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onSendMessage,
  onHighlightCitations,
  onFocusNode,
  isCollapsed,
  onToggleCollapsed,
}: CanvasAiPanelProps) {
  if (isCollapsed) {
    return (
      <aside className="chat-panel chat-panel-collapsed" aria-label="Canvas chat">
        <button type="button" onClick={onToggleCollapsed} aria-label="Open chats" title="Open chats">
          <PanelLeftOpen size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="chat-panel" aria-label="Canvas chat">
      <header className="chat-topbar">
        <div className="chat-title">
          <Bot size={16} />
          <span>AI Chat</span>
        </div>
        <div className="chat-topbar-actions">
          <button type="button" onClick={onToggleCollapsed} aria-label="Collapse chats" title="Collapse chats">
            <PanelLeftClose size={15} />
          </button>
          <button type="button" onClick={onNewChat} disabled={isCreatingChat} aria-label="New chat" title="New chat">
            <Plus size={15} />
          </button>
        </div>
      </header>

      <nav className="chat-list" aria-label="Conversations">
        {isCreatingChat ? (
          <div className="chat-list-saving">
            <span className="project-picker-spinner" aria-hidden="true" style={{ borderTopColor: "rgb(255 255 255 / 60%)", borderColor: "rgb(255 255 255 / 18%)" }} />
            Starting…
          </div>
        ) : null}
        {chats.length === 0 ? (
          <button type="button" className="chat-list-empty" onClick={onNewChat} disabled={isCreatingChat}>
            <Plus size={15} />
            <span>Start a conversation</span>
          </button>
        ) : (
          chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const isLoading = chat.id === loadingChatId;
            return (
              <div
                className={isActive ? "chat-list-item is-active" : "chat-list-item"}
                key={chat.id}
              >
                <button
                  type="button"
                  className="chat-list-select"
                  onClick={() => {
                    if (!isActive && !isLoading) {
                      onSelectChat(chat.id);
                    }
                  }}
                >
                  <strong>{chat.title}</strong>
                  <small>{isLoading ? "Loading..." : formatChatTimestamp(chat.updatedAt)}</small>
                </button>
                <button
                  type="button"
                  className="chat-list-delete"
                  aria-label={`Delete ${chat.title}`}
                  title="Delete chat"
                  onClick={() => {
                    onDeleteChat(chat.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </nav>

      <section className="chat-thread">
        <div className="chat-messages">
          {loadingChatId ? (
            <div className="chat-empty">
              <MessageSquareText size={22} />
              <p>Loading…</p>
            </div>
          ) : messages.length === 0 && !isSending ? (
            <div className="chat-empty">
              <MessageSquareText size={22} />
              <p>{activeChatId ? "Ask anything about your canvas." : "Ask a question to start analyzing this project."}</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <article className={`chat-message chat-message-${message.role}`} key={message.id}>
                  <div className="chat-bubble">
                    <ChatMessageContent message={message} />
                    {message.analysis ? (
                      <AnalysisMessage
                        message={message}
                        onFocusNode={onFocusNode}
                        onHighlightCitations={onHighlightCitations}
                      />
                    ) : null}
                  </div>
                </article>
              ))}
              {isSending ? (
                <Suspense fallback={<ChatThinkingFallback />}>
                  <ChatThinking />
                </Suspense>
              ) : null}
            </>
          )}
        </div>

        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            onSendMessage();
          }}
        >
          <Textarea
            value={question}
            rows={1}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="Ask about this project..."
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSendMessage();
              }
            }}
          />
          <Button icon={<Send size={15} />} variant="primary" disabled={!question.trim() || isSending} aria-label="Send message">
            {isSending ? "…" : ""}
          </Button>
        </form>
      </section>
    </aside>
  );
});

function ChatMessageContent({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return <p>{message.content}</p>;
  }

  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
    </div>
  );
}

function ChatThinkingFallback() {
  return (
    <article className="chat-message chat-message-assistant chat-message-thinking" aria-live="polite">
      <div className="chat-bubble chat-bubble-thinking">
        <div className="chat-thinking-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <strong>Thinking</strong>
          <span>Reading project context...</span>
        </div>
      </div>
    </article>
  );
}

function formatChatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Saved";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AnalysisMessage({
  message,
  onFocusNode,
  onHighlightCitations,
}: {
  message: ChatMessage;
  onFocusNode: (nodeId: string) => void;
  onHighlightCitations: (nodeIds: string[]) => void;
}) {
  const analysis = message.analysis;
  if (!analysis) {
    return null;
  }

  const citedNodeIds = analysis.citations.map((citation) => citation.nodeId);

  return (
    <div className="chat-analysis">
      {analysis.missingContext.length > 0 ? (
        <p className="chat-context-note">{analysis.missingContext[0]}</p>
      ) : null}
      {analysis.citations.length > 0 ? (
        <section>
          <div className="chat-analysis-heading">
            <span>Citations</span>
            <button type="button" onClick={() => onHighlightCitations(citedNodeIds)} aria-label="Highlight citations" title="Highlight citations">
              <Highlighter size={13} />
            </button>
          </div>
          <div className="citation-row">
            {analysis.citations.map((citation) => (
              <button key={citation.nodeId} type="button" onClick={() => onFocusNode(citation.nodeId)}>
                {citation.title}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
