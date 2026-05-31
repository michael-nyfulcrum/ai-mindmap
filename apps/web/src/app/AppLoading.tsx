export function AppLoading() {
  return (
    <main className="app-loading" aria-label="Loading AI Mindmap">
      <div className="app-loading-animation">
        <div className="app-loading-ai-badge">AI</div>
        <span className="app-loading-node app-loading-node-one" />
        <span className="app-loading-node app-loading-node-two" />
        <span className="app-loading-node app-loading-node-three" />
      </div>
      <h1>AI Mindmap</h1>
      <p>Loading your workspace...</p>
    </main>
  );
}
