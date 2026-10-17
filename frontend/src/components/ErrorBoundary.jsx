import { Component } from "react";
import { log } from "../logger.js";

// Catches render errors anywhere below it, logs them, and shows a fallback instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    log.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <section>
          <h1>Something went wrong</h1>
          <p>Try reloading the page.</p>
        </section>
      );
    }
    return this.props.children;
  }
}
