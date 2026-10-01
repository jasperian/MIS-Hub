import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { MisClient } from "../mcp/client";
import { createMisServer } from "../mcp/server";

const session = "a".repeat(64);
test("MCP preserves session, origin and dealership boundaries", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json({ records: [] });
  };
  const api = new MisClient({ url: "http://127.0.0.1:3000", session }, fetcher);
  const server = createMisServer(api);
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    const list = await client.listTools();
    assert.equal(list.tools.length, 5);
    assert.ok(list.tools.every(t => t.annotations?.readOnlyHint));
    const output = await client.callTool({ name: "mis_list_inventory", arguments: { dealershipId: "tne", kind: "computers" } });
    assert.ok(!output.isError);
    assert.equal(requests[0].url, "http://127.0.0.1:3000/api/records?kind=computers");
    assert.deepEqual(requests[0].init?.headers, { Cookie: `mis_session=${session}`, Origin: "http://127.0.0.1:3000", "X-Dealership-Id": "tne" });
    const invalid = await client.callTool({ name: "mis_list_inventory", arguments: { dealershipId: "../other" } });
    assert.equal(invalid.isError, true);
    assert.equal(requests.length, 1);
  } finally { await client.close(); await server.close(); }
});

test("login uses environment credentials and forwards only the session", async () => {
  let count = 0;
  const api = new MisClient({ url: "https://mis.example", email: "user@example.com", password: "private" }, async (url, init) => {
    count++;
    if (count === 1) {
      assert.equal(String(url), "https://mis.example/api/auth/login");
      assert.equal(init?.redirect, "error");
      return Response.json({ user: {} }, { headers: { "Set-Cookie": `mis_session=${session}; HttpOnly; Path=/` } });
    }
    assert.equal((init?.headers as Record<string, string>).Cookie, `mis_session=${session}`);
    assert.equal(init?.body, undefined);
    return Response.json({ user: {} });
  });
  await api.request("/api/auth/me");
  assert.equal(count, 2);
});

test("writes are blocked and remote cleartext connections rejected", async () => {
  assert.throws(() => new MisClient({ url: "http://mis.example" }), /HTTPS/);
  assert.throws(() => new MisClient({ url: "https://user:secret@mis.example" }), /origin/);
  const api = new MisClient({ url: "http://localhost:3000", session }, async () => { throw new Error("Should not call API"); });
  await assert.rejects(api.request("/api/records", "tne", "POST", {}), /disabled/);
});

test("API permission failures become MCP errors and mutations are never retried", async () => {
  let calls = 0;
  const api = new MisClient({ url: "http://localhost:3000", session, allowWrites: true }, async () => {
    calls++;
    return Response.json({ error: "sensitive internal text" }, { status: 403 });
  });
  const server = createMisServer(api, true);
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  try {
    assert.equal((await client.listTools()).tools.length, 8);
    const output = await client.callTool({ name: "mis_delete_inventory", arguments: { dealershipId: "tne", recordId: "record1" } });
    assert.equal(output.isError, true);
    assert.equal(calls, 1);
    assert.ok(!JSON.stringify(output).includes("sensitive internal text"));
  } finally { await client.close(); await server.close(); }
});
