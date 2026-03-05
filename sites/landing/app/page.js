"use client";

import { useState } from "react";

const installCommands = {
  oneLiner: "curl -fsSL https://clawperator.com/install.sh | bash",
  npm: "npm install -g clawperator"
};

const features = [
  {
    title: "Deterministic",
    body: "Strict contracts, no hidden retries, and a single canonical result envelope for every command."
  },
  {
    title: "Observable",
    body: "Rich, structured UI snapshots and explicit terminal markers for reliable agent state tracking."
  },
  {
    title: "Agent-First",
    body: "Machine-readable error codes and JSON-native output designed for robust branching logic."
  }
];

export default function Home() {
  const [mode, setMode] = useState("oneLiner");
  const [copied, setCopied] = useState(false);
  const activeCommand = mode === "npm" ? installCommands.npm : installCommands.oneLiner;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeCommand);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = activeCommand;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = activeCommand;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      } catch {
        setCopied(false);
      }
    }
  };

  return (
    <>
      <header className="top-toolbar">
        <div className="top-toolbar-inner">
          <a href="#top" className="toolbar-brand">
            <img src="/clawperator-logo.png" alt="" aria-hidden="true" className="toolbar-logo" />
            <span className="toolbar-brand-stack">
              <span className="toolbar-brand-text">Clawperator</span>
              <span className="toolbar-subtitle">Android automation for agents</span>
            </span>
          </a>

          <nav className="toolbar-links" aria-label="Page sections">
            <a href="#install">Install</a>
            <a href="#why">Why</a>
            <a href="#what">What</a>
            <a href="#how-it-works">How it works</a>
            <a href="https://docs.clawperator.com" target="_blank" rel="noreferrer">
              Docs
            </a>
            <a href="https://github.com/clawpilled/clawperator" target="_blank" rel="noreferrer" className="toolbar-cta">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="page-shell">
      {/* Hero Section */}
      <section id="top" className="hero-card">
        <div className="hero-grid">
          <div>
            <h1>Deterministic Android Automation for AI Agents</h1>
            <p className="hero-copy">
              Clawperator is the execution hand for an LLM brain. Drive real Android devices with stable contracts,
              strict command semantics, and machine-readable outcomes.
            </p>
          </div>

          <div className="hero-mascot-wrap" aria-hidden="true">
            <img src="/clawperator-logo.png" alt="" className="hero-mascot" />
          </div>
        </div>

        <div id="install" className="quickstart-block" aria-label="Quickstart terminal">
          <div className="quickstart-top">
            <div className="traffic-lights" aria-hidden="true">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>

            <div className="mode-switcher" role="tablist" aria-label="Install mode">
              <button
                type="button"
                className={mode === "oneLiner" ? "mode-btn active" : "mode-btn"}
                onClick={() => setMode("oneLiner")}
                role="tab"
                aria-selected={mode === "oneLiner"}
              >
                One-liner
              </button>
              <button
                type="button"
                className={mode === "npm" ? "mode-btn active" : "mode-btn"}
                onClick={() => setMode("npm")}
                role="tab"
                aria-selected={mode === "npm"}
              >
                npm
              </button>
            </div>
          </div>

          <div className="quickstart-command">
            <p className="quickstart-hint"># Install Clawperator on macOS/Linux</p>
            <div className="command-row">
              <pre>
                <code>{activeCommand}</code>
              </pre>
              <button
                type="button"
                className={copied ? "copy-btn copied" : "copy-btn"}
                onClick={handleCopy}
                aria-label={copied ? "Copied" : "Copy command"}
                title={copied ? "Copied" : "Copy command"}
              >
                {copied ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M20 7L9 18l-5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="9" y="9" width="11" height="11" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2" />
                    <rect x="4" y="4" width="11" height="11" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid - Core Principles */}
      <section id="features" className="feature-grid" aria-label="Core features">
        <div className="feature-intro">
          <h2>Features</h2>
          <p>Tools agents can trust: deterministic execution, structured outputs, and composable automation.</p>
        </div>

        {features.map((feature) => (
          <article key={feature.title} className="feature-card">
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      {/* Why Section */}
      <section id="why" className="content-section">
        <h2>Why Clawperator?</h2>
        <p>
          Many consumer services only expose critical data in mobile apps, not public web APIs.
        </p>

        <ul>
          <li>Family tracking and location apps</li>
          <li>Home automation apps</li>
          <li>Grocery and shopping apps</li>
          <li>Ride-hailing apps</li>
        </ul>

        <p>
          Clawperator lets AI agents interact with these apps on your behalf. The interface stays predictable and
          stable so skills can be created, reused, and shared.
        </p>
      </section>

      {/* What Section */}
      <section id="what" className="content-section">
        <h2>What Is Clawperator?</h2>
        <p>
          Clawperator is the execution layer for LLM-driven Android automation. It provides a deterministic Node.js
          CLI and HTTP API, the hand for an LLM brain.
        </p>
        <div className="grid-2-col">
          <div>
            <h3>What agents can do</h3>
            <ul>
              <li>Connect to a real Android device</li>
              <li>Run deterministic UI actions (tap, scroll, type, read)</li>
              <li>Observe screen state via structured snapshots</li>
              <li>Get canonical terminal results (`[Clawperator-Result]`)</li>
              <li>Compose primitives into repeatable skills</li>
            </ul>
          </div>
          <div>
            <h3>Design principles</h3>
            <ul>
              <li><strong>Deterministic:</strong> Strict contracts, no hidden retries, one result envelope per command.</li>
              <li><strong>Observable:</strong> Structured UI snapshots and machine-readable error codes.</li>
              <li><strong>Agent-first:</strong> JSON output, typed errors, single-flight concurrency.</li>
            </ul>
          </div>
        </div>

        <div className="setup-note">
          <p>
            <strong>Typical setup:</strong> A dedicated Android device (any cheap or old phone) stays connected to
            your host machine as a permanent actuator. Your agent sends commands through Clawperator, and Clawperator
            executes and reports results.
          </p>
        </div>
      </section>

      <section id="how-it-works" className="content-section loop-section">
        <h2>How It Works</h2>
        <p>The hand loop is simple and deterministic: observe, decide, execute, and report.</p>

        <div className="loop-steps" aria-label="Clawperator hand loop">
          <article className="loop-step">
            <p className="loop-index">01</p>
            <div>
              <h3>Observe</h3>
              <p>Capture structured UI state from the Android device so the agent can reason on a stable snapshot.</p>
            </div>
          </article>

          <article className="loop-step">
            <p className="loop-index">02</p>
            <div>
              <h3>Decide</h3>
              <p>The brain chooses the next action based on selectors and current state. Clawperator does not plan.</p>
            </div>
          </article>

          <article className="loop-step">
            <p className="loop-index">03</p>
            <div>
              <h3>Execute</h3>
              <p>Run deterministic device actions (tap, type, scroll, read) with strict validation and no hidden retries.</p>
            </div>
          </article>

          <article className="loop-step">
            <p className="loop-index">04</p>
            <div>
              <h3>Return</h3>
              <p>Emit one canonical terminal envelope (`[Clawperator-Result]`) with machine-readable success or failure.</p>
            </div>
          </article>
        </div>
      </section>

        <footer className="site-footer">
          <p className="footer-title">Clawperator</p>
          <p className="footer-copy">Built for fast, reproducible Android automation from single actions to full agent runs.</p>
          <nav className="footer-links" aria-label="Footer links">
            <a href="https://docs.clawperator.com" target="_blank" rel="noreferrer">
              docs
            </a>
            <a href="https://github.com/clawpilled/clawperator" target="_blank" rel="noreferrer">
              github
            </a>
            <a href="https://www.npmjs.com/package/clawperator" target="_blank" rel="noreferrer">
              npm
            </a>
          </nav>
        </footer>
      </main>
    </>
  );
}
