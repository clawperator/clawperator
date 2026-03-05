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
    <main className="page-shell">
      {/* Hero Section */}
      <section className="hero-card">
        <div className="brand-row">
          <img src="/clawperator-logo.png" alt="Clawperator logo" className="logo" />
          <p className="brand-text">Clawperator</p>
        </div>

        <h1>Deterministic Android Automation for AI Agents</h1>
        <p className="hero-copy">
          Clawperator is the execution hand for an LLM brain. Drive real Android devices with stable contracts,
          strict command semantics, and machine-readable outcomes.
        </p>

        <div className="quickstart-block" aria-label="Quickstart terminal">
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
      <section className="feature-grid" aria-label="Core features">
        {features.map((feature) => (
          <article key={feature.title} className="feature-card">
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      {/* Why Section */}
      <section className="content-section">
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
      <section className="content-section">
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

      <footer className="footer-links">
        <a href="https://docs.clawperator.com" target="_blank" rel="noreferrer">
          docs.clawperator.com
        </a>
        <a href="https://github.com/clawpilled/clawperator" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href="https://www.npmjs.com/package/clawperator" target="_blank" rel="noreferrer">
          npm
        </a>
      </footer>
    </main>
  );
}
