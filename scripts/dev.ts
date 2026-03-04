/// Dev orchestrator: starts the Go backend, discovers its port, then launches
/// Vite with the correct proxy target.

const controller = new AbortController();

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => controller.abort());
}

const backend = Bun.spawn(
  [
    "watchexec",
    "-r",
    "-e",
    "go",
    "--",
    "go",
    "run",
    "./cmd/server",
    "--no-open",
    "--dev",
    "--debug",
  ],
  { stdout: "pipe", stderr: "inherit", signal: controller.signal },
);

const portPattern = / on \S+:(\d+)\s*$/;

async function discoverPort(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error("backend exited before printing a port");

    buf += decoder.decode(value, { stream: true });

    // Process complete lines, keep partial tail in buf.
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);

      process.stdout.write(`${line}\n`);

      const m = line.match(portPattern);
      if (m) {
        // Keep forwarding remaining backend output in the background.
        forwardStream(reader, decoder, buf);
        return m[1];
      }
    }
  }
}

async function forwardStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  initial: string,
) {
  if (initial) process.stdout.write(initial);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    process.stdout.write(decoder.decode(value, { stream: true }));
  }
}

const port = await discoverPort(backend.stdout);

const vite = Bun.spawn(["bun", "run", "dev"], {
  cwd: "app",
  stdout: "inherit",
  stderr: "inherit",
  signal: controller.signal,
  env: { ...process.env, DEV_API_PORT: port },
});

await Promise.allSettled([backend.exited, vite.exited]);

// Exit with backend's code (most likely source of failure).
process.exit(await backend.exited);
