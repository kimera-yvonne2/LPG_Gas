import React, { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./Report";
import "./styles.css";
import "./report.css";

class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <main style={{ color: "white", fontFamily: "system-ui", padding: "3rem" }}><h1>Lumora website could not start</h1><pre style={{ color: "#fca5a5", whiteSpace: "pre-wrap" }}>{this.state.error.message}</pre></main>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
