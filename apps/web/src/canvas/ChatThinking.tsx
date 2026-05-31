export function ChatThinking() {
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
          <span>Reading the saved canvas and composing an answer...</span>
        </div>
      </div>
    </article>
  );
}
