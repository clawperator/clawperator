/** Metadata only: never retain stream contents, command payloads or UI text. */
export class ResultReaderTimeline {
  private readonly started = performance.now();
  private readonly startedAt = new Date().toISOString();
  private readonly events: Array<Record<string, string | number | boolean | null>> = [];
  private droppedEvents = 0;
  private readerPid: number | null = null;
  private readonly streams = {
    stdout: { bytes: 0, lastOutputElapsedMs: null as number | null },
    stderr: { bytes: 0, lastOutputElapsedMs: null as number | null },
  };

  record(event: string, details: Record<string, string | number | boolean | null> = {}): void {
    if (this.events.length === 32) {
      this.events.shift();
      this.droppedEvents++;
    }
    this.events.push({ ...details, event, elapsedMs: this.elapsedMs() });
  }

  spawned(pid: number | undefined): void {
    this.readerPid = pid ?? null;
    this.record("process_created", { readerPid: this.readerPid });
  }

  observe(stream: "stdout" | "stderr", bytes: number): void {
    if (bytes === 0) return;
    const state = this.streams[stream];
    if (state.bytes === 0) this.record(`first_${stream}`);
    state.bytes += bytes;
    state.lastOutputElapsedMs = this.elapsedMs();
  }

  snapshot() {
    return {
      hostPid: process.pid, readerPid: this.readerPid, startedAt: this.startedAt,
      elapsedMs: this.elapsedMs(), droppedEvents: this.droppedEvents,
      stdoutBytes: this.streams.stdout.bytes, stderrBytes: this.streams.stderr.bytes,
      lastStdoutElapsedMs: this.streams.stdout.lastOutputElapsedMs,
      lastStderrElapsedMs: this.streams.stderr.lastOutputElapsedMs,
      events: this.events.map(event => ({ ...event })),
    };
  }

  private elapsedMs(): number {
    return Math.round((performance.now() - this.started) * 1000) / 1000;
  }
}
