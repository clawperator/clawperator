"use client";

import { useEffect, useRef, useState } from "react";

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
  const [showToolbar, setShowToolbar] = useState(false);
  const heroLogoRef = useRef(null);
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

  useEffect(() => {
    if (!heroLogoRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setShowToolbar(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(heroLogoRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header className={showToolbar ? "top-toolbar visible" : "top-toolbar hidden"}>
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
        <div className="hero-waterfall">
          <img ref={heroLogoRef} src="/clawperator-logo.png" alt="" aria-hidden="true" className="hero-logo" />
          <p className="hero-product-name">Clawperator</p>
          <h1 className="hero-catchphrase">Deterministic Android Automation for AI Agents</h1>
          <p className="hero-summary">
            Let AI agents use and control Android apps on behalf of users.
            <br />
            Clawperator connects your agent to a dedicated Android device so it can observe the screen, perform UI
            actions, and receive structured results.
          </p>
        </div>

        <div className="quickstart-intro">
          <h2 id="install">Quick Start</h2>
        </div>

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
        <h2>Unlocking the Mobile-First World</h2>
        <p>
          Your digital life often lives behind mobile walls. From family tracking and home automation to grocery 
          delivery and ride-hailing, many essential services only exist as apps—not web APIs.
        </p>
        <p>
          Clawperator gives your AI agent the "hands" it needs to help you where you actually spend your 
          time. It provides a stable, predictable way for agents to navigate the apps you use every day, 
          turning mobile silos into open platforms.
        </p>
      </section>

      {/* What Section */}
      <section id="what" className="content-section">
        <h2>The Bridge Between Brain and Device</h2>
        <p>
          Think of Clawperator as the execution layer for AI. It translates high-level agent reasoning into 
          precise, real-world device actions. It's the rock-solid connection that lets an LLM "brain" 
          interact with physical Android hardware.
        </p>
        <div className="grid-2-col">
          <div>
            <h3>Empower Your Agent</h3>
            <ul>
              <li>Connect to real Android hardware instantly</li>
              <li>Execute precise taps, scrolls, and typing</li>
              <li>"See" the screen through structured UI data</li>
              <li>Build and share repeatable automation skills</li>
            </ul>
          </div>
          <div>
            <h3>Built for Reliability</h3>
            <ul>
              <li><strong>Deterministic:</strong> No guesswork or hidden retries.</li>
              <li><strong>Observable:</strong> Every action returns a verifiable result.</li>
              <li><strong>Agent-First:</strong> Built for JSON and machine-readable errors.</li>
            </ul>
          </div>
        </div>

        <div className="setup-note">
          <p>
            <strong>The Actuator Model:</strong> Use any cheap or old Android phone as a dedicated 
            "burner" device. Keep it connected to your host machine, and your agent has a permanent, 
            24/7 hand to get things done.
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
