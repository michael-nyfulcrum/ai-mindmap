import Lottie from "lottie-react";
import loadingAnimation from "../app/loadingAnimation.json";

export function ChatThinking() {
  return (
    <article className="chat-message chat-message-assistant chat-message-thinking" aria-live="polite">
      <div className="chat-bubble chat-bubble-thinking">
        <div className="chat-thinking-animation">
          <Lottie animationData={loadingAnimation} loop autoplay />
        </div>
        <div>
          <strong>Thinking</strong>
          <span>Reading the saved canvas and composing an answer...</span>
        </div>
      </div>
    </article>
  );
}
