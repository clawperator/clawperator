"use client";

import { useEffect, useRef, useState } from "react";

const installCommands = {
  oneLiner: "curl -fsSL https://clawperator.com/install.sh | bash",
  npm: "npm install -g clawperator"
};

const reliabilityCards = [
  {
    title: "Deterministic",
    body: "Each command does one thing, returns one result, and never hides retries."
  },
  {
    title: "Structured",
    body: "Agents get machine-readable UI state, explicit errors, and results they can branch on."
  },
  {
    title: "Built for loops",
    body: "Clawperator is designed for reasoning systems that need predictable execution, not best-effort automation."
  }
];

const workflowCards = [
  {
    title: "Home battery and energy apps",
    body: "Read Powerwall, battery, or inverter status from mobile-only apps and trigger actions when thresholds are crossed."
  },
  {
    title: "Google Home and thermostat control",
    body: "Check temperature, switch device state, and turn heating or cooling on without waiting for a public API that may never exist."
  },
  {
    title: "School app notification filtering",
    body: "Monitor a noisy school app, filter the clutter, and surface only the updates that actually matter."
  },
  {
    title: "Family location flows",
    body: "Check Life360-style apps and send updates or screenshots until someone gets home, then stop automatically."
  },
  {
    title: "Shopping, delivery, and status checks",
    body: "Build private workflows around grocery, courier, or account apps that only really exist as mobile interfaces."
  },
  {
    title: "App-only balances and alerts",
    body: "Pull statuses, balances, or alerts from user-installed Android apps that do not expose a usable public API."
  }
];

const faqs = [
  {
    question: "Can I use this if I have an iPhone?",
    answer:
      "Yes. Clawperator does not require you to switch your primary phone to Android. The normal setup is to keep using your iPhone and connect your agent to a separate Android burner phone or a local Android emulator."
  },
  {
    question: "I do not have an Android phone. Can I still use Clawperator?",
    answer:
      "Yes. Clawperator can provision a local Google Play-equipped Android emulator. That is useful for getting started, local development, and many automation flows."
  },
  {
    question: "Do I need a dedicated burner phone?",
    answer:
      "A cheap dedicated burner phone is the preferred setup for compatibility and long-running reliability, but it is not the only option. A local Android emulator is available when you do not have a device handy."
  },
  {
    question: "What if the skill I need does not exist yet?",
    answer:
      "That is fine. Clawperator includes a growing open source skills library, but you are not blocked on prebuilt skills. Your agent can use Clawperator's structured, documented API to explore an app, operate it, and build a private skill for your own workflow."
  },
  {
    question: "Does Clawperator do the thinking for my agent?",
    answer:
      "No. The agent decides what to do next. Clawperator executes validated Android actions and returns structured results."
  }
];

export default function Home() {
  const [mode, setMode] = useState("oneLiner");
  const [copied, setCopied] = useState(false);
  const [emulatorCommandCopied, setEmulatorCommandCopied] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const activeCommand = mode === "npm" ? installCommands.npm : installCommands.oneLiner;
  const emulatorCommand = "clawperator provision emulator";

  const sectionIds = ["install", "skills", "how-it-works", "faq"];
  const sectionLabels = {
    install: "Install",
    skills: "Skills",
    "how-it-works": "How it works",
    faq: "FAQ"
  };

  const copyTimeoutRef = useRef(null);
  const emulatorCopyTimeoutRef = useRef(null);

  const copyToClipboard = async (text, setCopiedState, timeoutRef) => {
    const fallbackCopy = () => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        if (!fallbackCopy()) throw new Error("Fallback copy failed");
      }
    } catch {
      try {
        if (!fallbackCopy()) {
          setCopiedState(false);
          return;
        }
      } catch {
        setCopiedState(false);
        return;
      }
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    
    setCopiedState(true);
    timeoutRef.current = window.setTimeout(() => {
      setCopiedState(false);
      timeoutRef.current = null;
    }, 1200);
  };

  const handleCopy = () => copyToClipboard(activeCommand, setCopied, copyTimeoutRef);
  const handleEmulatorCommandCopy = () => copyToClipboard(emulatorCommand, setEmulatorCommandCopied, emulatorCopyTimeoutRef);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      if (emulatorCopyTimeoutRef.current) window.clearTimeout(emulatorCopyTimeoutRef.current);
    };
  }, []);

  const toolbarRef = useRef(null);

  useEffect(() => {
    let frame = null;

    const updateActiveSection = () => {
      const toolbarHeight = toolbarRef.current?.offsetHeight || 80;
      // Use a focus line below the toolbar so a section becomes active when it is
      // meaningfully on screen, not the instant a heading peeks into view.
      const focusY = window.scrollY + toolbarHeight + Math.min(window.innerHeight * 0.22, 180);
      const docBottom = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // Last section needs a bottom-of-page fallback because the FAQ heading may
      // never climb near the toolbar on shorter pages.
      if (docBottom >= docHeight - 48) {
        setActiveSection("faq");
        return;
      }

      let nextActive = null;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (focusY >= top) {
          nextActive = id;
        } else {
          break;
        }
      }

      setActiveSection(nextActive);
    };

    const requestUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        updateActiveSection();
      });
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!activeSection) {
      if (!window.location.hash) return;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return;
    }

    const nextHash = `#${activeSection}`;
    if (window.location.hash === nextHash) return;
    window.history.replaceState(null, "", nextHash);
  }, [activeSection]);

  return (
    <>
      <header ref={toolbarRef} className="top-toolbar">
        <div className="top-toolbar-inner">
          <a href="#top" className="toolbar-brand">
            <img src="/clawperator-logo.png" alt="" aria-hidden="true" className="toolbar-logo" />
            <span className="toolbar-brand-stack">
              <span className="toolbar-brand-text">Clawperator</span>
              <span className="toolbar-subtitle">Android automation for agents</span>
            </span>
          </a>

          <nav className="toolbar-links" aria-label="Page sections">
            {sectionIds.map((id) => (
              <a
                key={id}
                href={`#${id}`}
                className={activeSection === id ? "toolbar-section-link active" : "toolbar-section-link"}
              >
                {sectionLabels[id] || id}
              </a>
            ))}
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
          <p className="hero-problem">Many services don&apos;t have APIs…<br />But they do have apps!</p>
          <img src="/clawperator-logo.png" alt="" aria-hidden="true" className="hero-logo" />
          <p className="hero-product-name">Clawperator</p>
          <h1 className="hero-catchphrase">
            YOUR AGENT THINKS.
            <br />
            CLAWPERATOR ACTS.
          </h1>
          <p className="hero-category-line">Clawperator makes Android apps programmable - think Playwright for mobile apps.</p>
          <p className="hero-summary">
          Clawperator is a deterministic execution layer that lets agents/Claws operate real Android apps to read data and take actions on behalf of users.
          </p>
          <p className="hero-brain-hand">
            Your agent or LLM is the brain.
            <br />
            Clawperator is the hand.
          </p>
          <p className="hero-summary hero-summary-secondary">
            Connect your claw to a dedicated Android burner phone, run your own private skills and get answers your agent can trust.
          </p>

          <div className="hero-image-panel">
            <img
              src="https://static.clawperator.com/img/hero/clawperator-hero.webp"
              alt="Diagram showing how OpenClaw and Clawperator let AI agents control real Android apps and return results to chat. This image was made with human claws."
              title="this image was made with human claws"
              width="780"
              height="286"
              className="hero-diagram"
            />
          </div>

          <p className="hero-summary hero-summary-secondary">
            Don't have an Android device? No problem. Clawperator will create a Google Play equipped Android emulator on your Mac mini or OpenClaw box for you.
          </p>

          </div>

      <section id="workflows" className="content-section">
        <h2>What you can do with Clawperator</h2>
        <p className="workflow-subtitle">
          Clawperator is most useful where the real interface only exists in a mobile app.
        </p>

        <div className="workflow-cards">
          {workflowCards.map((card) => (
            <article key={card.title} className="workflow-card workflow-card-simple">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

        <div className="quickstart-intro">
          <h2 id="install">Quick Start</h2>
          <p>
            One command installs the CLI, fetches the latest Clawperator Operator Android app, verifies it, and helps
            prepare an Android device for your agent.
          </p>
          <p>
            A cheap burner Android phone is still the preferred setup for compatibility and long-running reliability.
            You do not need to switch from iPhone to Android. If you do not have an Android device handy, Clawperator
            can provision a local Google Play-equipped emulator and walk you through the same setup flow.
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

          <div className="quickstart-command">
            <p className="quickstart-hint">
              No Android device handy? No worries. Clawperator can create a Google Play equipped Android emulator on
              your Mac mini or OpenClaw box after install.
            </p>
            <div className="command-row">
              <pre>
                <code>{emulatorCommand}</code>
              </pre>
              <button
                type="button"
                className={emulatorCommandCopied ? "copy-btn copied" : "copy-btn"}
                onClick={handleEmulatorCommandCopy}
                aria-label={emulatorCommandCopied ? "Copied" : "Copy command"}
                title={emulatorCommandCopied ? "Copied" : "Copy command"}
              >
                {emulatorCommandCopied ? (
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

        <p className="quickstart-docs">
          Clawperator has comprehensive documentation, setup guides, and API references at{" "}
          <a href="https://docs.clawperator.com" target="_blank" rel="noreferrer">
            docs.clawperator.com
          </a>
          .
        </p>

        <div className="agent-entry-strip" aria-label="For agents">
          <p className="agent-entry-title">For agents</p>
          <p className="agent-entry-copy">
            Prefer the technical docs over this overview page. Start with the{" "}
            <a href="https://docs.clawperator.com/ai-agents/node-api-for-agents/" target="_blank" rel="noreferrer">
              Node API guide
            </a>
            , the{" "}
            <a href="https://docs.clawperator.com/design/operator-llm-playbook/" target="_blank" rel="noreferrer">
              Operator LLM playbook
            </a>
            , or the machine-oriented <a href="/index.md">markdown landing page</a>.
          </p>
          <div className="agent-entry-links">
            <a href="/agents">/agents</a>
            <a href="/index.md">/index.md</a>
            <a href="https://docs.clawperator.com/reference/cli-reference/" target="_blank" rel="noreferrer">
              CLI reference
            </a>
            <a href="https://docs.clawperator.com/reference/api-overview/" target="_blank" rel="noreferrer">
              API overview
            </a>
          </div>
        </div>
      </section>

      <section id="reliability" className="feature-grid">
        <div className="feature-intro">
          <h2>Built for agent loops</h2>
          <p>More than UI automation. Each command does one thing, returns one result, and never hides retries.</p>
          <div className="contract-strip">
            <span>action</span>
            <span className="contract-arrow">&rarr;</span>
            <span>execution</span>
            <span className="contract-arrow">&rarr;</span>
            <span>structured result</span>
          </div>
          <div className="loop-example">
            <p className="loop-example-label">
              Example agent loop (pseudocode - see{" "}
              <a href="https://docs.clawperator.com" target="_blank" rel="noreferrer">
                docs.clawperator.com
              </a>{" "}
              for the full API)
            </p>
            <pre>
              <code>{`open_app(<google_home_app_id>)
snapshot_ui()
click(<climate_tab>)
snapshot_ui()
scroll_and_click(<device_labeled_"Living room">)
snapshot_ui()
if <hvac_state> == "Off":
  click(<turn_on>)`}</code>
            </pre>
          </div>
        </div>

        {reliabilityCards.map((feature) => (
          <article key={feature.title} className="feature-card">
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <section id="skills" className="content-section">
        <h2>Skills</h2>
        <p>
          Clawperator automations are unlocked through skills.
        </p>
        <p>
          Clawperator includes an open source, ever-expanding skills repository for common Android workflows.
        </p>
        <p>
          But you are not blocked waiting for an official skill. Agents do not need a prebuilt skill to automate your
          apps.
        </p>
        <p>
          Our dedicated build-your-own-skill-from-scratch documentation walks agents through the process step by step.
          Point your agent at the right app and tell it to make a skill. It can use the <code>clawperator</code> API
          to inspect the app&apos;s UI, find a reliable path to the state or action you need, and create a private,
          personalized skill for your exact workflow.
        </p>

        <div className="grid-2-col">
          <div>
            <h3>Included with install</h3>
            <ul>
              <li>Open source skills repository</li>
              <li>Reusable building blocks for common workflows</li>
              <li>Discoverable and runnable through the same runtime</li>
            </ul>
          </div>
          <div>
            <h3>Yours to create</h3>
            <ul>
              <li>Private skills for your own apps and accounts</li>
              <li>Agent-built skills from live app exploration</li>
              <li>Public and private skills mixed in the same runtime</li>
            </ul>
          </div>
        </div>

        <div className="setup-note">
          <p>
            <strong>You are not blocked waiting for a public skill.</strong> Start with included skills, adapt them to
            your setup, or let your agent create private ones through Clawperator&apos;s documented API.
          </p>
        </div>
      </section>

      <section id="how-it-works" className="content-section architecture-section loop-section">
        <h2>How it actually works</h2>
        <p>
          Your agent is the brain. Clawperator is the hand. Skills sit above the runtime as reusable app-specific
          workflows. Whether the agent runs a skill or drives the UI step by step, Clawperator is the execution layer
          that talks to the Android device and returns structured results.
        </p>
        <div className="architecture-strip">
          <article className="architecture-card architecture-card-edge">
            <div className="architecture-card-stack">
              <p className="architecture-label">AI Agent / LLM</p>
              <p className="architecture-meta">the brain</p>
            </div>
          </article>
          <div className="architecture-connector">
            <span className="architecture-line" />
            <span className="architecture-text">Node API / CLI / Skills</span>
          </div>
          <article className="architecture-card architecture-card-core">
            <div className="architecture-card-stack">
              <p className="architecture-label">Clawperator</p>
              <p className="architecture-meta">runtime / hand</p>
            </div>
          </article>
          <div className="architecture-connector">
            <span className="architecture-line" />
            <span className="architecture-text">ADB</span>
          </div>
          <article className="architecture-card architecture-card-core">
            <div className="architecture-card-stack">
              <p className="architecture-label">Android Device</p>
              <p className="architecture-meta">physical or emulator</p>
            </div>
          </article>
          <div className="architecture-connector">
            <span className="architecture-line" />
          </div>
          <article className="architecture-card architecture-card-edge">
            <div className="architecture-card-stack">
              <p className="architecture-label">Mobile Apps</p>
              <p className="architecture-meta">the app is the api</p>
            </div>
          </article>
        </div>
        <p>
          The runtime includes the CLI on your host machine and the Clawperator Operator Android app on the Android
          device. The agent decides what to do next. Skills give the agent reusable ways to handle app-specific
          workflows it already understands, whether those come from the open source skills repository or from private
          skills the agent created for you. Clawperator executes validated actions against user-installed Android apps
          and returns machine-readable state.
        </p>
        <div className="grid-2-col">
          <div>
            <h3>When a skill exists</h3>
            <ul>
              <li>The agent picks a skill for a known app workflow</li>
              <li>The skill packages the reliable path to the state or action needed</li>
              <li>Clawperator still executes the underlying Android actions and returns the result</li>
            </ul>
          </div>
          <div>
            <h3>When no skill exists yet</h3>
            <ul>
              <li>The agent opens the app and inspects the live UI</li>
              <li>It finds a reliable path step by step using the documented API</li>
              <li>Once the flow is understood, it can turn that path into a private skill</li>
            </ul>
          </div>
        </div>
        <p>The operating loop is simple: observe, decide, execute, return.</p>

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
              <p>The agent chooses the next action or runs a skill. Clawperator does not plan, improvise, or decide on its own.</p>
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

      <section id="faq" className="content-section faq-section">
        <h2>FAQ</h2>
        <div className="faq-list">
          {faqs.map((item) => (
            <details key={item.question} className="faq-item">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

        <footer className="site-footer">
          <p className="footer-title">Clawperator</p>
          <p className="footer-copy">Open source execution infrastructure for agent-driven Android burner-device workflows.</p>
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
