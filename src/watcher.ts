import chokidar, { type FSWatcher } from "chokidar";

export class ReferencesWatcher {
  private readonly refsDir: string;
  private readonly onChange: (paths: Set<string>) => void;
  private watcher: FSWatcher | null = null;
  private timer: NodeJS.Timeout | null = null;
  private paths = new Set<string>();

  constructor(refsDir: string, onChange: (paths: Set<string>) => void) {
    this.refsDir = refsDir;
    this.onChange = onChange;
  }

  static enabled(): boolean {
    return process.env.LINEAR_WATCH === "1";
  }

  start(): void {
    const debounceMs = Math.max(0, Number(process.env.LINEAR_WATCH_DEBOUNCE ?? "1.0") * 1000);

    this.watcher = chokidar.watch(this.refsDir, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    const schedule = (filePath: string): void => {
      this.paths.add(filePath);
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        const snapshot = new Set(this.paths);
        this.paths.clear();
        this.onChange(snapshot);
      }, debounceMs);
    };

    this.watcher.on("add", schedule);
    this.watcher.on("change", schedule);
    this.watcher.on("unlink", schedule);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
