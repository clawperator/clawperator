"use client";

import { useEffect, useRef, useState } from "react";

const installCommands = {
  oneLiner: "curl -fsSL https://clawperator.com/install.sh | bash",
  npm: "npm install -g clawperator"
};

const features = [
  {
    title: "Deterministic Actions",
    body: "Each command does one thing, returns one result, and never hides retries behind the scenes."
  },
  {
    title: "Structured Device State",
    body: "Your agent gets clear UI snapshots and machine-readable results it can actually branch on."
  },
  {
    title: "Agent-Friendly Errors",
    body: "Failures come back as explicit, machine-readable errors instead of vague logs or guesswork."
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
          <p className="hero-problem">Most services only expose their real functionality through mobile apps.</p>
          <h1 className="hero-catchphrase">Your agent thinks. Clawperator acts.</h1>
          <p className="hero-summary">
            Let AI agents control Android apps on behalf of users.
            <br />
            Your agent or LLM is the «brain».
            <br />
            Clawperator is the «hand».
            <br />
            The brain decides what to do next. Clawperator connects that agent to a dedicated Android burner phone,
            executes the action, and returns structured results your code can trust.
          </p>
        </div>

        <div className="quickstart-intro">
          <h2 id="install">Quick Start</h2>
          <p>
            One command installs the CLI, fetches the latest operator app, verifies it, and helps prepare a connected
            Android device for your agent.
          </p>
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
          <p>Built for agent loops that need clear device state, predictable actions, and machine-readable results.</p>
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
        <h2>Why use Clawperator?</h2>
        <p>
          Many important services still live inside mobile apps. Home automation controls, grocery apps, family
          tracking tools, ride-hailing, banking companions, and other everyday workflows often have no public API worth
          using.
        </p>
        <p>
          Clawperator gives your agent a practical way to work in that world. Instead of pretending every service has an
          integration, you connect the agent to a real Android device and let it operate the app UI the same way a
          person would.
        </p>
      </section>

      {/* What Section */}
      <section id="what" className="content-section">
        <h2>What is Clawperator?</h2>
        <p>
          Clawperator is the hand for your agent. The agent is the brain: it reads state, reasons about the next step,
          and decides what to do. Clawperator executes that decision on Android and reports back what happened.
        </p>
        <div className="grid-2-col">
          <div>
            <h3>What your agent gets</h3>
            <ul>
              <li>Connect to a real Android burner phone from a simple Node API or CLI</li>
              <li>Tap, type, scroll, launch apps, and inspect the current UI</li>
              <li>Works with OpenClaw, custom agents, and any AI system capable of making API calls</li>
              <li>Compose reusable skills that automate real mobile workflows</li>
              <li>Build repeatable automations without baking app-specific strategy into the runtime</li>
            </ul>
          </div>
          <div>
            <h3>Typical setup</h3>
            <ul>
              <li>Use any cheap or old Android phone as a dedicated device for your agent</li>
              <li>Keep it plugged in and connected to your host machine as a permanent hand</li>
              <li>Point your agent at the CLI or Node API and let it drive the phone on the user&apos;s behalf</li>
              <li>Coming soon: run the same model entirely in an Android emulator, without a physical device</li>
            </ul>
          </div>
        </div>

        <div className="setup-note">
          <p>
            <strong>The burner phone model:</strong> Clawperator commonly runs on a cheap Android phone dedicated to
            agent work. This keeps automation isolated from your primary phone and gives your agent a persistent device
            it can safely control.
          </p>
        </div>
      </section>

      <section className="content-section architecture-section" aria-label="The architecture">
        <h2>The architecture</h2>
        <div className="architecture-strip" role="img" aria-label="AI agent or LLM connects through the Clawperator runtime to an Android burner device, which operates mobile apps">
          <article className="architecture-card">
            <p className="architecture-label">AI Agent / LLM</p>
            <p className="architecture-meta">the «brain»</p>
          </article>
          <div className="architecture-connector">
            <span className="architecture-line" />
            <span className="architecture-text">Node API / CLI</span>
          </div>
          <article className="architecture-card">
            <p className="architecture-label">Clawperator</p>
            <p className="architecture-meta">runtime / «hand»</p>
          </article>
          <div className="architecture-connector">
            <span className="architecture-line" />
            <span className="architecture-text">USB / ADB</span>
          </div>
          <article className="architecture-card">
            <p className="architecture-label">Android Burner Device</p>
            <p className="architecture-meta">dedicated actuator</p>
          </article>
          <div className="architecture-connector">
            <span className="architecture-line" />
          </div>
          <article className="architecture-card">
            <p className="architecture-label">Mobile Apps</p>
            <p className="architecture-meta">the real interfaces</p>
          </article>
        </div>
        <p>
          Your agent reasons about what should happen. Clawperator executes those decisions on a real Android device.
        </p>
      </section>

      <section id="reliability" className="content-section">
        <h2>Reliability</h2>
        <p>
          Clawperator favors predictable execution over automation magic. Commands are strict, results are explicit, and
          the runtime stays out of the planning loop.
        </p>
        <div className="grid-2-col">
          <div>
            <h3>What stays predictable</h3>
            <ul>
              <li>Deterministic execution with no hidden retries</li>
              <li>One result per command, with clear success or failure</li>
              <li>Structured UI snapshots your agent can inspect between steps</li>
            </ul>
          </div>
          <div>
            <h3>What your agent can rely on</h3>
            <ul>
              <li>Machine-readable errors instead of hand-parsed logs</li>
              <li>Stable command and task identifiers through the full request path</li>
              <li>A runtime that executes validated actions instead of inventing strategy</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="content-section loop-section">
        <h2>How It Works</h2>
        <p>The loop is simple: the brain observes and decides, the hand executes and reports back.</p>

        <div className="loop-steps" aria-label="Clawperator hand loop">
          <article className="loop-step">
            <p className="loop-index">01</p>
            <div>
              <h3>Observe</h3>
              <p>Capture the current Android UI as structured state so the agent can reason on a real snapshot of the app.</p>
            </div>
          </article>

          <article className="loop-step">
            <p className="loop-index">02</p>
            <div>
              <h3>Decide</h3>
              <p>The agent chooses the next action. Clawperator does not plan, improvise, or decide on its own.</p>
            </div>
          </article>

          <article className="loop-step">
            <p className="loop-index">03</p>
            <div>
              <h3>Execute</h3>
              <p>Clawperator performs the requested tap, type, scroll, read, or app action on the connected Android device.</p>
            </div>
          </article>

          <article className="loop-step">
            <p className="loop-index">04</p>
            <div>
              <h3>Return</h3>
              <p>Return one machine-readable result so the agent can continue, recover, or stop with confidence.</p>
            </div>
          </article>
        </div>
      </section>

        <footer className="site-footer">
          <p className="footer-title">Clawperator</p>
          <p className="footer-copy">Open source Android automation for AI agents. From single commands to full burner-device workflows.</p>
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
