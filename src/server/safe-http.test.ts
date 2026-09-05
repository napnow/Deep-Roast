import assert from "node:assert/strict";
import dns from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { EventEmitter } from "node:events";
import https, { type RequestOptions } from "node:https";
import type { IncomingMessage } from "node:http";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import {
  assertPublicHttpsUrl,
  requestPublicHttpsBuffer,
  requestPublicHttpsResponse,
} from "./safe-http";

test("accepts public HTTPS URLs without embedded credentials", () => {
  const url = assertPublicHttpsUrl("https://models.example/v1");

  assert.equal(url.href, "https://models.example/v1");
});

test("rejects non-HTTPS URLs and embedded credentials", () => {
  assert.throws(() => assertPublicHttpsUrl("http://models.example/v1"));
  assert.throws(() =>
    assertPublicHttpsUrl("https://user:secret@models.example/v1"),
  );
});

test("rejects literal non-public IPv4 and IPv6 targets", () => {
  const blocked = [
    "https://127.0.0.1/v1",
    "https://10.12.0.8/v1",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/v1",
    "https://[fc00::1]/v1",
    "https://[fe80::1]/v1",
    "https://[ff02::1]/v1",
    "https://[::ffff:127.0.0.1]/v1",
    "https://[64:ff9b:1::1]/v1",
  ];

  for (const value of blocked) {
    assert.throws(() => assertPublicHttpsUrl(value), value);
  }
});

test("rejects a hostname when any DNS answer is non-public", async (t) => {
  t.mock.method(dns, "lookup", async () => [
    { address: "93.184.216.34", family: 4 as const },
    { address: "10.0.0.7", family: 4 as const },
  ]);

  await assert.rejects(
    requestPublicHttpsBuffer("https://models.example/v1/models", {
      timeoutMs: 100,
      maxBytes: 1024,
    }),
  );
});

test("pins the validated DNS address and preserves the HTTPS hostname", async (t) => {
  t.mock.method(dns, "lookup", async () => [
    { address: "93.184.216.34", family: 4 as const },
  ]);

  let connectedAddress = "";
  let connectedFamily = 0;
  let requestedHostname = "";
  let requestedServername = "";

  t.mock.method(https, "request", ((
    url: URL,
    options: RequestOptions,
    onResponse: ((response: IncomingMessage) => void) | undefined,
  ) => {
    requestedHostname = url.hostname;
    requestedServername = String(options.servername || "");
    options.lookup?.(
      url.hostname,
      {},
      (
        _error: NodeJS.ErrnoException | null,
        address: string | LookupAddress[],
        family?: number,
      ) => {
        connectedAddress = String(address);
        connectedFamily = Number(family);
      },
    );

    const req = new EventEmitter() as EventEmitter & {
      destroy(error?: Error): void;
      end(): void;
    };
    req.destroy = (error?: Error) => {
      if (error) queueMicrotask(() => req.emit("error", error));
    };
    req.end = () => {
      const res = new PassThrough() as PassThrough & {
        statusCode: number;
        headers: Record<string, string>;
      };
      res.statusCode = 200;
      res.headers = { "content-type": "application/json" };
      assert.ok(onResponse);
      onResponse(res as unknown as IncomingMessage);
      res.end('{"data":[]}');
    };
    return req;
  }) as unknown as typeof https.request);

  const result = await requestPublicHttpsBuffer(
    "https://models.example/v1/models",
    { timeoutMs: 100, maxBytes: 1024 },
  );

  assert.equal(requestedHostname, "models.example");
  assert.equal(requestedServername, "models.example");
  assert.equal(connectedAddress, "93.184.216.34");
  assert.equal(connectedFamily, 4);
  assert.equal(result.status, 200);
  assert.equal(result.body.toString("utf8"), '{"data":[]}');
});

test("does not reuse an HTTPS socket outside the validated DNS lookup", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile("src/server/safe-http.ts", "utf8"),
  );
  assert.match(source, /agent:\s*false/);
});

test("rejects redirects without issuing a second request", async (t) => {
  t.mock.method(dns, "lookup", async () => [
    { address: "93.184.216.34", family: 4 as const },
  ]);
  let requests = 0;

  t.mock.method(https, "request", ((
    _url: URL,
    _options: RequestOptions,
    onResponse: ((response: IncomingMessage) => void) | undefined,
  ) => {
    requests += 1;
    const req = new EventEmitter() as EventEmitter & {
      destroy(error?: Error): void;
      end(): void;
    };
    req.destroy = (error?: Error) => {
      if (error) queueMicrotask(() => req.emit("error", error));
    };
    req.end = () => {
      const res = new PassThrough() as PassThrough & {
        statusCode: number;
        headers: Record<string, string>;
      };
      res.statusCode = 302;
      res.headers = { location: "https://127.0.0.1/secret" };
      assert.ok(onResponse);
      onResponse(res as unknown as IncomingMessage);
      res.end();
    };
    return req;
  }) as unknown as typeof https.request);

  await assert.rejects(
    requestPublicHttpsBuffer("https://models.example/redirect", {
      timeoutMs: 100,
      maxBytes: 1024,
    }),
  );
  assert.equal(requests, 1);
});

test("destroys oversized responses as soon as maxBytes is exceeded", async (t) => {
  t.mock.method(dns, "lookup", async () => [
    { address: "93.184.216.34", family: 4 as const },
  ]);
  let responseDestroyed = false;

  t.mock.method(https, "request", ((
    _url: URL,
    _options: RequestOptions,
    onResponse: ((response: IncomingMessage) => void) | undefined,
  ) => {
    const req = new EventEmitter() as EventEmitter & {
      destroy(error?: Error): void;
      end(): void;
    };
    req.destroy = (error?: Error) => {
      if (error) queueMicrotask(() => req.emit("error", error));
    };
    req.end = () => {
      const res = new PassThrough() as PassThrough & {
        statusCode: number;
        headers: Record<string, string>;
      };
      res.statusCode = 200;
      res.headers = {};
      const originalDestroy = res.destroy.bind(res);
      res.destroy = ((error?: Error) => {
        responseDestroyed = true;
        return originalDestroy(error);
      }) as typeof res.destroy;
      assert.ok(onResponse);
      onResponse(res as unknown as IncomingMessage);
      res.write(Buffer.alloc(6));
      res.end(Buffer.alloc(6));
    };
    return req;
  }) as unknown as typeof https.request);

  await assert.rejects(
    requestPublicHttpsBuffer("https://models.example/large", {
      timeoutMs: 100,
      maxBytes: 8,
    }),
  );
  assert.equal(responseDestroyed, true);
});

test("aborts requests that exceed timeoutMs", async (t) => {
  t.mock.method(dns, "lookup", async () => [
    { address: "93.184.216.34", family: 4 as const },
  ]);
  let requestDestroyed = false;

  t.mock.method(https, "request", (() => {
    const req = new EventEmitter() as EventEmitter & {
      destroy(error?: Error): void;
      end(): void;
    };
    req.destroy = (error?: Error) => {
      requestDestroyed = true;
      if (error) queueMicrotask(() => req.emit("error", error));
    };
    req.end = () => undefined;
    return req;
  }) as unknown as typeof https.request);

  await assert.rejects(
    requestPublicHttpsBuffer("https://models.example/slow", {
      timeoutMs: 10,
      maxBytes: 1024,
    }),
  );
  assert.equal(requestDestroyed, true);
});

test("safe POST requests pin DNS, reject redirects, and write the supplied body", async (t) => {
  t.mock.method(dns, "lookup", async () => [
    { address: "93.184.216.34", family: 4 as const },
  ]);
  let method = "";
  let writtenBody = "";

  t.mock.method(https, "request", ((
    _url: URL,
    options: RequestOptions,
    onResponse: ((response: IncomingMessage) => void) | undefined,
  ) => {
    method = String(options.method || "");
    const req = new EventEmitter() as EventEmitter & {
      destroy(error?: Error): void;
      end(data?: string | Buffer): void;
    };
    req.destroy = (error?: Error) => {
      if (error) queueMicrotask(() => req.emit("error", error));
    };
    req.end = (data?: string | Buffer) => {
      writtenBody = data?.toString() || "";
      const res = new PassThrough() as PassThrough & {
        statusCode: number;
        headers: Record<string, string>;
      };
      res.statusCode = 200;
      res.headers = { "content-type": "application/json" };
      onResponse?.(res as unknown as IncomingMessage);
      res.end('{"ok":true}');
    };
    return req;
  }) as unknown as typeof https.request);

  const response = await requestPublicHttpsResponse(
    "https://models.example/v1/chat/completions",
    {
      method: "POST",
      body: '{"stream":true}',
      timeoutMs: 100,
      maxBytes: 1024,
    },
  );

  assert.equal(method, "POST");
  assert.equal(writtenBody, '{"stream":true}');
  assert.equal(await response.text(), '{"ok":true}');
});

test("safe response transport accepts null-body statuses without throwing", async (t) => {
  t.mock.method(dns, "lookup", async () => [
    { address: "93.184.216.34", family: 4 as const },
  ]);

  t.mock.method(https, "request", ((
    _url: URL,
    _options: RequestOptions,
    onResponse: ((response: IncomingMessage) => void) | undefined,
  ) => {
    const req = new EventEmitter() as EventEmitter & {
      destroy(error?: Error): void;
      end(): void;
    };
    req.destroy = (error?: Error) => {
      if (error) queueMicrotask(() => req.emit("error", error));
    };
    req.end = () => {
      const res = new PassThrough() as PassThrough & {
        statusCode: number;
        headers: Record<string, string>;
      };
      res.statusCode = 204;
      res.headers = {};
      onResponse?.(res as unknown as IncomingMessage);
      res.end();
    };
    return req;
  }) as unknown as typeof https.request);

  const response = await requestPublicHttpsResponse(
    "https://models.example/v1/chat/completions",
    { method: "POST", timeoutMs: 100, maxBytes: 1024 },
  );

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
});

test("safe response transport does not drain the upstream before consumers pull", async (t) => {
  t.mock.method(dns, "lookup", async () => [
    { address: "93.184.216.34", family: 4 as const },
  ]);
  let responseStream: PassThrough | undefined;

  t.mock.method(https, "request", ((
    _url: URL,
    _options: RequestOptions,
    onResponse: ((response: IncomingMessage) => void) | undefined,
  ) => {
    const req = new EventEmitter() as EventEmitter & {
      destroy(error?: Error): void;
      end(): void;
    };
    req.destroy = (error?: Error) => {
      if (error) queueMicrotask(() => req.emit("error", error));
    };
    req.end = () => {
      responseStream = new PassThrough({ highWaterMark: 16 });
      const res = responseStream as PassThrough & {
        statusCode: number;
        headers: Record<string, string>;
      };
      res.statusCode = 200;
      res.headers = {};
      onResponse?.(res as unknown as IncomingMessage);
      res.write(Buffer.alloc(64));
    };
    return req;
  }) as unknown as typeof https.request);

  const response = await requestPublicHttpsResponse(
    "https://models.example/v1/chat/completions",
    { method: "POST", timeoutMs: 1_000, maxBytes: 1024 },
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(responseStream?.readableFlowing, false);

  await response.body?.cancel();
});
