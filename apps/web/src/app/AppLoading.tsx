export function AppLoading() {
  return (
    <main className="app-loading" aria-label="Loading Context Canvas">
      <div className="app-loading-animation">
        <div className="app-loading-ai-badge">AI</div>
        <span className="app-loading-node app-loading-node-one" />
        <span className="app-loading-node app-loading-node-two" />
        <span className="app-loading-node app-loading-node-three" />
      </div>
      <h1>Context Canvas</h1>
      <p>Synthesizing saved project context</p>
    </main>
  );
}
