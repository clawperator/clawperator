"use client";

import { useEffect, useState } from "react";

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
  const [emulatorCommandCopied, setEmulatorCommandCopied] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const activeCommand = mode === "npm" ? installCommands.npm : installCommands.oneLiner;
  const emulatorCommand = "clawperator provision emulator";

  const sectionIds = ["install", "workflows", "why", "what", "skills", "how-it-works"];
  const sectionLabels = { install: "Install", workflows: "Examples", why: "Why", what: "What", skills: "Skills", "how-it-works": "How it works" };

  const copyToClipboard = async (text, setCopiedState) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedState(true);
      window.setTimeout(() => setCopiedState(false), 1200);
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedState(true);
        window.setTimeout(() => setCopiedState(false), 1200);
      } catch {
        setCopiedState(false);
      }
    }
  };

  const handleCopy = () => copyToClipboard(activeCommand, setCopied);
  const handleEmulatorCommandCopy = () => copyToClipboard(emulatorCommand, setEmulatorCommandCopied);

  useEffect(() => {
    const visibleSections = new Map();
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.intersectionRatio);
          } else {
            visibleSections.delete(entry.target.id);
          }
        }
        // Pick the section with the highest visibility; later sections win ties
        let best = null;
        let bestRatio = 0;
        for (const id of sectionIds) {
          const ratio = visibleSections.get(id);
          if (ratio !== undefined && ratio >= bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        setActiveSection(best);
      },
      { threshold: [0, 0.2, 0.4], rootMargin: `-${80 + 16}px 0px -30% 0px` }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    }
    return () => sectionObserver.disconnect();
  }, []);

  return (
    <>
      <header className="top-toolbar visible">
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
          <p className="hero-problem">Most services only expose their real functionality through mobile apps.</p>
          <img src="/clawperator-logo.png" alt="" aria-hidden="true" className="hero-logo" />
          <p className="hero-product-name">Clawperator</p>
          <h1 className="hero-catchphrase">
            YOUR AGENT THINKS.
            <br />
            CLAWPERATOR ACTS.
          </h1>
          <p className="hero-summary">
            Let AI agents control Android apps on behalf of users.
            <br />
            <br />
            Your agent or LLM is the brain.
            <br />
            Clawperator is the hand.
            <br />
            <br />
            The brain decides what to do next.
            <br />
            Clawperator connects that agent to a dedicated Android burner phone or local Android emulator, executes the action, and returns reliable, structured results your agent can trust and use to build your own private workflows on top of.
          </p>

          <div className="hero-image-panel">
            <img
              src="https://static.clawperator.com/img/hero/clawperator_hero.webp"
              alt="Diagram showing how OpenClaw and Clawperator let AI agents control real Android apps and return results to chat. This image was made with human claws."
              title="this image was made with human claws"
              className="hero-diagram"
            />
          </div>
          </div>
        <div className="quickstart-intro">
          <h2 id="install">Quick Start</h2>
          <p>
            One command installs the CLI, fetches the latest operator app, verifies it, and helps prepare an Android
            device for your agent.
          </p>
          <p>
            A cheap burner Android phone is still the preferred setup for compatibility and long-running reliability.
            Do not have an Android device handy? No problem. Clawperator can provision a Google Play equipped emulator
            for you after install and walk you through the same setup flow.
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
      </section>

      <section id="workflows" className="content-section">
        <h2>Real-world examples</h2>
        <p className="workflow-subtitle">
          Each workflow below runs on an Android device.
          A natural request goes in, a concrete result comes back.
        </p>

        <div className="workflow-cards">
          <article className="workflow-card">
            <div className="workflow-exchange">
              <div className="workflow-msg workflow-msg-user">
                <p className="workflow-role">User <span className="workflow-channel">via Telegram</span></p>
                <p>&ldquo;Turn on the living room AC.&rdquo;</p>
              </div>
              <div className="workflow-msg workflow-msg-agent">
                <p className="workflow-role">OpenClaw</p>
                <p>Uses Clawperator to open the Google Home app on the Android device and turn on the living room AC in cooling mode.</p>
              </div>
              <div className="workflow-msg workflow-msg-response">
                <p className="workflow-role">Response</p>
                <p>&ldquo;Living room AC is on and cooling. It&rsquo;s 27&#176;C in there right now.&rdquo;</p>
              </div>
            </div>
          </article>

          <article className="workflow-card">
            <div className="workflow-exchange">
              <div className="workflow-msg workflow-msg-user">
                <p className="workflow-role">User <span className="workflow-channel">via Telegram</span></p>
                <p>&ldquo;Where is Amy right now?&rdquo;</p>
              </div>
              <div className="workflow-msg workflow-msg-agent">
                <p className="workflow-role">OpenClaw</p>
                <p>Uses Clawperator to open Life360 on the Android device and look up Amy&rsquo;s current location.</p>
              </div>
              <div className="workflow-msg workflow-msg-response">
                <p className="workflow-role">Response</p>
                <p>&ldquo;Amy is on Riverside Rd, heading east. Location updated 2 minutes ago.&rdquo;</p>
              </div>
            </div>
          </article>

        </div>
      </section>

      {/* Feature Grid - Core Principles */}
      <section id="features" className="feature-grid" aria-label="Core features">
        <div className="feature-intro">
          <h2>Features</h2>
          <p>Built for agent loops that require clear device state, predictable actions, and machine-readable results.</p>
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
          integration, you connect the agent to an Android device and let it operate the app UI the same way a
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
              <li>Connect to a physical Android burner phone or local Android emulator from a simple Node API or CLI</li>
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
              <li>Or provision a Google Play equipped Android emulator locally when you do not have a device handy</li>
            </ul>
          </div>
        </div>

        <div className="setup-note">
          <p>
            <strong>The burner phone model:</strong> Clawperator commonly runs on a cheap Android phone dedicated to
            agent work. This keeps automation isolated from your primary phone and gives your agent a persistent device
            it can safely control. When a physical device is not available, Clawperator can also provision a local
            Android emulator as a fallback environment.
          </p>
        </div>
      </section>

      <section className="content-section architecture-section" aria-label="The architecture">
        <h2>The architecture</h2>
        <div className="architecture-strip">
          <article className="architecture-card architecture-card-edge">
            <p className="architecture-label">AI Agent / LLM</p>
            <p className="architecture-meta">the brain</p>
          </article>
          <div className="architecture-connector">
            <span className="architecture-line" />
            <span className="architecture-text">Node API / CLI</span>
          </div>
          <article className="architecture-card architecture-card-core">
            <p className="architecture-label">Clawperator</p>
            <p className="architecture-meta">runtime / hand</p>
          </article>
          <div className="architecture-connector">
            <span className="architecture-line" />
            <span className="architecture-text">USB / ADB</span>
          </div>
          <article className="architecture-card architecture-card-core">
            <p className="architecture-label">Android Device</p>
            <p className="architecture-meta">physical or emulator</p>
          </article>
          <div className="architecture-connector">
            <span className="architecture-line" />
          </div>
          <article className="architecture-card architecture-card-edge">
            <p className="architecture-label">Mobile Apps</p>
            <p className="architecture-meta">the real APIs</p>
          </article>
        </div>
        <p>
          Your agent reasons about what should happen. Clawperator executes those decisions on an Android device. This
          turns mobile apps into programmable interfaces your agent can use. The Clawperator runtime includes the CLI
          on your host machine and a lightweight operator app running on the Android device, installed automatically by
          the setup script.
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

      <section id="skills" className="content-section">
        <h2>Skills</h2>
        <p>
          Skills are packaged automation scripts that turn common mobile workflows into repeatable, agent-ready
          operations. Each skill targets a specific app and task - check the air conditioner status, capture a
          settings overview, or pull data from a tracking app.
        </p>
        <p>
          Skills are packaged and distributed as a versioned bundle via the Clawperator installer.
          Each skill is standalone and designed to be invoked directly or through the Node API -
          discover, search, and run skills through a single interface.
        </p>

        <div className="skills-examples">
          <article className="skill-example">
            <p className="skill-example-label">Discover</p>
            <pre><code>clawperator skills search --app com.android.settings</code></pre>
          </article>
          <article className="skill-example">
            <p className="skill-example-label">Run</p>
            <pre><code>{`clawperator skills run com.android.settings.capture-overview \\
  --device-id <device_id>`}</code></pre>
          </article>
          <article className="skill-example">
            <p className="skill-example-label">Or invoke directly</p>
            <pre><code>{`node ~/.clawperator/skills/skills/com.android.settings.capture-overview/scripts/capture_settings_overview.js \\
  <device_id>`}</code></pre>
          </article>
        </div>

        <div className="grid-2-col">
          <div>
            <h3>For agents</h3>
            <ul>
              <li>Search skills by app, intent, or keyword</li>
              <li>Get structured metadata before deciding what to run</li>
              <li>Invoke directly or through the Node API - no lock-in</li>
            </ul>
          </div>
          <div>
            <h3>For builders</h3>
            <ul>
              <li>Write a script, add a registry entry, and your skill is live</li>
              <li>Skills are plain scripts - Node, shell, or anything with a shebang</li>
              <li>One install command pulls the full skills library</li>
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
