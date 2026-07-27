// Web Serial connection wrapper: opens a port, reads newline-delimited text
// in a background loop, and exposes a writer for commands.

export type SerialStatus = "closed" | "open" | "error";

export function serialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export class SerialLink {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private keepReading = false;
  private buffer = "";
  private decoder = new TextDecoder();

  constructor(
    private readonly onLine: (line: string) => void,
    private readonly onStatus: (status: SerialStatus, detail?: string) => void,
  ) {}

  get isOpen(): boolean {
    return this.port != null;
  }

  /** Prompt the browser port picker and open at the given baud rate. */
  async connect(baudRate: number): Promise<void> {
    if (!serialSupported()) throw new Error("此浏览器不支持 Web Serial（请用桌面版 Chrome / Edge）");
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate });
    this.port = port;
    this.keepReading = true;
    this.onStatus("open");
    this.readLoop().catch((err) => {
      this.onStatus("error", err instanceof Error ? err.message : String(err));
    });
  }

  private async readLoop(): Promise<void> {
    while (this.keepReading && this.port?.readable) {
      const reader = this.port.readable.getReader();
      this.reader = reader;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) this.ingest(value);
        }
      } catch (err) {
        if (this.keepReading) {
          this.onStatus("error", err instanceof Error ? err.message : String(err));
        }
      } finally {
        reader.releaseLock();
        this.reader = null;
      }
    }
  }

  private ingest(chunk: Uint8Array): void {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    let idx: number;
    // Split on \n; tolerate \r\n.
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, "");
      this.buffer = this.buffer.slice(idx + 1);
      if (line.length) this.onLine(line);
    }
    // Guard against a runaway line with no newline.
    if (this.buffer.length > 8192) this.buffer = this.buffer.slice(-1024);
  }

  /** Write raw text to the device. */
  async send(text: string): Promise<void> {
    if (!this.port?.writable) throw new Error("串口未连接");
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(text));
    } finally {
      writer.releaseLock();
    }
  }

  async disconnect(): Promise<void> {
    this.keepReading = false;
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    try {
      await this.port?.close();
    } catch {
      /* ignore */
    }
    this.port = null;
    this.onStatus("closed");
  }
}
