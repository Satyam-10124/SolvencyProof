"use client";

export interface YellowSession {
  sessionId: string;
  participants: string[];
  allocations: Record<string, string>;
  status: "active" | "closing" | "closed";
  round: number;
}

export interface YellowLog {
  timestamp: number;
  type: "info" | "sent" | "received" | "error";
  message: string;
  data?: unknown;
}

export class YellowClient {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private messageId = 0;
  private pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();

  public onConnect?: () => void;
  public onDisconnect?: () => void;
  public onLog?: (log: YellowLog) => void;

  constructor(wsUrl = "wss://sandbox.clearnode.yellow.com") {
    this.wsUrl = wsUrl;
  }

  private log(type: YellowLog["type"], message: string, data?: unknown) {
    this.onLog?.({ timestamp: Date.now(), type, message, data });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.log("info", `Connecting to ${this.wsUrl}...`);
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          this.log("info", "Connected to Yellow ClearNode");
          this.onConnect?.();
          resolve();
        };

        this.ws.onclose = () => {
          this.log("info", "Disconnected from ClearNode");
          this.onDisconnect?.();
        };

        this.ws.onerror = (error) => {
          this.log("error", "WebSocket error", error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.log("received", "INBOUND", data);
            this.handleMessage(data);
          } catch (err) {
            this.log("error", "Parse error", err);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleMessage(data: { id?: string; result?: unknown; error?: unknown }) {
    if (data.id && this.pendingRequests.has(data.id)) {
      const { resolve, reject } = this.pendingRequests.get(data.id)!;
      this.pendingRequests.delete(data.id);

      if (data.error) {
        reject(data.error);
      } else {
        resolve(data.result);
      }
    }
  }

  private send(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = `${++this.messageId}`;
      const message = { id, method, params };

      this.log("sent", `OUTBOUND [${method}]`, message);
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(message));

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async getConfig(): Promise<unknown> {
    return this.send("get_config", {});
  }

  async getBalance(address: string): Promise<unknown> {
    return this.send("get_balance", { address });
  }

  async requestFaucet(address: string, token = "ytest.usd", amount = "100"): Promise<unknown> {
    return this.send("faucet_request", { address, token, amount });
  }

  async createSession(
    participants: string[],
    token: string,
    wagerAmount: string
  ): Promise<{ sessionId: string }> {
    const result = await this.send("create_app_session", {
      participants,
      token,
      wager_amount: wagerAmount,
      rules: {
        participant_count: participants.length,
        approval_threshold: participants.length,
      },
    });
    return result as { sessionId: string };
  }

  async updateState(
    sessionId: string,
    allocations: Record<string, string>,
    round: number
  ): Promise<unknown> {
    return this.send("submit_app_state", {
      session_id: sessionId,
      allocations,
      round,
    });
  }

  async closeSession(sessionId: string): Promise<unknown> {
    return this.send("close_app_session", { session_id: sessionId });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export function exportToLiabilitiesCSV(allocations: Record<string, string>): string {
  const rows = ["user_id,balance"];
  Object.entries(allocations).forEach(([userId, balance]) => {
    rows.push(`${userId},${balance}`);
  });
  return rows.join("\n");
}
