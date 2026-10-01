export interface McpConfig {
  url: string;
  session?: string;
  email?: string;
  password?: string;
  allowWrites?: boolean;
}

/** Use the application's HTTP boundary so permissions and transactions stay authoritative. */
export class MisClient {
  readonly origin: string;
  private session?: string;
  constructor(private config: McpConfig, private fetcher: typeof fetch = fetch) {
    const url = new URL(config.url);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/")
      throw new Error("MIS_MCP_URL must be an origin without credentials, path or query.");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
      throw new Error("Use HTTPS for remote MIS Hub connections.");
    this.origin = url.origin;
    this.session = config.session;
    if (this.session && !/^[a-f0-9]{64}$/.test(this.session)) throw new Error("Invalid MIS session token.");
  }

  async request(path: string, dealershipId?: string, method = "GET", body?: unknown): Promise<Record<string, unknown>> {
    if (!path.startsWith("/api/") || path.includes("..") || path.includes("#")) throw new Error("Invalid API path.");
    if (method !== "GET" && !this.config.allowWrites) throw new Error("Inventory writes are disabled.");
    if (!this.session) await this.login();
    return this.send(path, dealershipId, method, body);
  }

  private async login() {
    if (!this.config.email || !this.config.password) throw new Error("Set MIS_MCP_EMAIL and MIS_MCP_PASSWORD, or MIS_MCP_SESSION.");
    const response = await this.fetcher(this.origin + "/api/auth/login", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { Origin: this.origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.config.email, password: this.config.password }),
    });
    if (!response.ok) throw new Error(`MIS login failed (HTTP ${response.status}).`);
    const token = response.headers.get("set-cookie")?.match(/(?:^|[,;]\s*)mis_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (!token) throw new Error("MIS login did not return a session.");
    this.session = token;
  }

  private async send(path: string, dealershipId: string | undefined, method: string, body: unknown) {
    const headers: Record<string, string> = { Cookie: `mis_session=${this.session}`, Origin: this.origin };
    if (dealershipId) headers["X-Dealership-Id"] = dealershipId;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await this.fetcher(this.origin + path, {
      method, headers, redirect: "error", signal: AbortSignal.timeout(15000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    // Never retry a mutation: it might already have committed.
    if (response.status === 401) {
      this.session = undefined;
      throw new Error("MIS session expired or revoked. Retry to sign in again.");
    }
    if (!response.ok) throw new Error(`MIS API rejected the request (HTTP ${response.status}). Check permissions, dealership and record data.`);
    return await response.json() as Record<string, unknown>;
  }
}
