import dns from "node:dns/promises";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import type { IncomingHttpHeaders } from "node:http";
import { ApiError } from "./http";

export interface SafeHttpOptions {
  headers?: Record<string, string>;
  timeoutMs: number;
  maxBytes: number;
}

export interface SafeHttpRequestOptions extends SafeHttpOptions {
  method?: "GET" | "POST";
  body?: string | Buffer;
  signal?: AbortSignal;
}

export interface SafeHttpResult {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

type ResolvedAddress = { address: string; family: 4 | 6 };

const invalidTarget = () => new ApiError("目标地址不允许访问", 400);
const requestFailed = () => new ApiError("无法安全访问远程服务", 400);
const requestTimedOut = () => new ApiError("远程服务请求超时", 400);
const responseTooLarge = () => new ApiError("远程服务响应过大", 400);

function parseIpv4(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

function isInIpv4Range(value: number, network: number, prefix: number) {
  const shift = 32 - prefix;
  return (value >>> shift) === (network >>> shift);
}

function isNonPublicIpv4(address: string): boolean {
  const value = parseIpv4(address);
  if (value === null) return true;

  const blocked: Array<[number, number]> = [
    [0x00000000, 8],
    [0x0a000000, 8],
    [0x64400000, 10],
    [0x7f000000, 8],
    [0xa9fe0000, 16],
    [0xac100000, 12],
    [0xc0000000, 24],
    [0xc0000200, 24],
    [0xc0a80000, 16],
    [0xc6120000, 15],
    [0xc6336400, 24],
    [0xcb007100, 24],
    [0xe0000000, 4],
    [0xf0000000, 4],
  ];

  return blocked.some(([network, prefix]) =>
    isInIpv4Range(value, network, prefix),
  );
}

function parseIpv6(address: string): number[] | null {
  let raw = address.toLowerCase();
  const zoneIndex = raw.indexOf("%");
  if (zoneIndex !== -1) raw = raw.slice(0, zoneIndex);

  if (raw.includes(".")) {
    const lastColon = raw.lastIndexOf(":");
    const ipv4 = parseIpv4(raw.slice(lastColon + 1));
    if (lastColon === -1 || ipv4 === null) return null;
    raw = `${raw.slice(0, lastColon)}:${(ipv4 >>> 16).toString(16)}:${(
      ipv4 & 0xffff
    ).toString(16)}`;
  }

  const halves = raw.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  if (halves.length === 2 && missing < 1) return null;

  const words = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ].map((word) => (/^[0-9a-f]{1,4}$/.test(word) ? Number.parseInt(word, 16) : -1));

  return words.length === 8 && words.every((word) => word >= 0)
    ? words
    : null;
}

function embeddedIpv4(words: number[]): string {
  return [
    words[6] >>> 8,
    words[6] & 0xff,
    words[7] >>> 8,
    words[7] & 0xff,
  ].join(".");
}

function isNonPublicIpv6(address: string): boolean {
  const words = parseIpv6(address);
  if (!words) return true;

  const allZero = words.every((word) => word === 0);
  const loopback = words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  if (allZero || loopback) return true;

  const ipv4Compatible = words.slice(0, 6).every((word) => word === 0);
  const ipv4Mapped =
    words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (ipv4Compatible || ipv4Mapped) {
    return isNonPublicIpv4(embeddedIpv4(words));
  }

  const uniqueLocal = (words[0] & 0xfe00) === 0xfc00;
  const linkLocal = (words[0] & 0xffc0) === 0xfe80;
  const siteLocal = (words[0] & 0xffc0) === 0xfec0;
  const multicast = (words[0] & 0xff00) === 0xff00;
  const documentation = words[0] === 0x2001 && words[1] === 0x0db8;
  const teredo = words[0] === 0x2001 && words[1] === 0;
  if (
    uniqueLocal ||
    linkLocal ||
    siteLocal ||
    multicast ||
    documentation ||
    teredo
  ) {
    return true;
  }

  if (words[0] === 0x2002) {
    const sixToFourIpv4 = [
      words[1] >>> 8,
      words[1] & 0xff,
      words[2] >>> 8,
      words[2] & 0xff,
    ].join(".");
    return isNonPublicIpv4(sixToFourIpv4);
  }

  // RFC 8215 local-use translation prefix; the embedded address is deployment-specific.
  const localNat64 =
    words[0] === 0x0064 && words[1] === 0xff9b && words[2] === 0x0001;
  if (localNat64) return true;

  const nat64 =
    words[0] === 0x0064 &&
    words[1] === 0xff9b &&
    words.slice(2, 6).every((word) => word === 0);
  return nat64 ? isNonPublicIpv4(embeddedIpv4(words)) : false;
}

function isNonPublicIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isNonPublicIpv4(address);
  if (family === 6) return isNonPublicIpv6(address);
  return true;
}

function hostnameWithoutBrackets(hostname: string) {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

export function assertPublicHttpsUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidTarget();
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw invalidTarget();
  }

  const hostname = hostnameWithoutBrackets(url.hostname);
  if (isIP(hostname) && isNonPublicIp(hostname)) {
    throw invalidTarget();
  }

  return url;
}

async function lookupWithTimeout(
  hostname: string,
  timeoutMs: number,
): Promise<ResolvedAddress[]> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      dns.lookup(hostname, { all: true, verbatim: true }) as Promise<
        ResolvedAddress[]
      >,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(requestTimedOut()), timeoutMs);
      }),
    ]);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw requestFailed();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function requestPublicHttpsBuffer(
  value: string,
  options: SafeHttpOptions & { signal?: AbortSignal },
): Promise<SafeHttpResult> {
  const url = assertPublicHttpsUrl(value);
  if (
    !Number.isFinite(options.timeoutMs) ||
    options.timeoutMs <= 0 ||
    !Number.isSafeInteger(options.maxBytes) ||
    options.maxBytes <= 0
  ) {
    throw new ApiError("安全请求参数无效", 500);
  }

  const startedAt = Date.now();
  const hostname = hostnameWithoutBrackets(url.hostname);
  const answers = await lookupWithTimeout(hostname, options.timeoutMs);
  if (
    answers.length === 0 ||
    answers.some(
      (answer) =>
        answer.family !== isIP(answer.address) || isNonPublicIp(answer.address),
    )
  ) {
    throw invalidTarget();
  }

  const selected = answers[0];
  const remainingMs = options.timeoutMs - (Date.now() - startedAt);
  if (remainingMs <= 0) throw requestTimedOut();

  const pinnedLookup: LookupFunction = (_hostname, _lookupOptions, callback) => {
    callback(null, selected.address, selected.family);
  };

  const headers = { ...options.headers };
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === "host") delete headers[key];
  }
  headers.Host = url.host;

  return new Promise<SafeHttpResult>((resolve, reject) => {
    let settled = false;

    const finish = (
      error?: ApiError,
      result?: SafeHttpResult,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else if (result) resolve(result);
    };

    const request = https.request(
      url,
      {
        method: "GET",
        headers,
        lookup: pinnedLookup,
        family: selected.family,
        agent: false,
        ...(isIP(hostname) ? {} : { servername: hostname }),
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400) {
          response.resume();
          finish(new ApiError("远程服务重定向已被拒绝", 400));
          request.destroy();
          return;
        }

        const declaredLength = Number(response.headers["content-length"] || 0);
        if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
          finish(responseTooLarge());
          response.destroy();
          request.destroy();
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        response.on("data", (chunk: Buffer | Uint8Array | string) => {
          if (settled) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buffer.length;
          if (totalBytes > options.maxBytes) {
            finish(responseTooLarge());
            response.destroy();
            request.destroy();
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          finish(undefined, {
            status,
            headers: response.headers,
            body: Buffer.concat(chunks, totalBytes),
          });
        });
        response.on("error", () => finish(requestFailed()));
      },
    );

    request.on("error", () => finish(requestFailed()));
    const abort = () => {
      finish(requestTimedOut());
      request.destroy();
    };
    const timer = setTimeout(abort, remainingMs);
    if (options.signal?.aborted) {
      abort();
      return;
    }
    options.signal?.addEventListener("abort", abort, { once: true });
    request.end();
  });
}

export async function requestPublicHttpsResponse(
  value: string,
  options: SafeHttpRequestOptions,
): Promise<Response> {
  const url = assertPublicHttpsUrl(value);
  if (
    !Number.isFinite(options.timeoutMs) ||
    options.timeoutMs <= 0 ||
    !Number.isSafeInteger(options.maxBytes) ||
    options.maxBytes <= 0
  ) {
    throw new ApiError("安全请求参数无效", 500);
  }

  const startedAt = Date.now();
  const hostname = hostnameWithoutBrackets(url.hostname);
  const answers = await lookupWithTimeout(hostname, options.timeoutMs);
  if (
    answers.length === 0 ||
    answers.some(
      (answer) =>
        answer.family !== isIP(answer.address) || isNonPublicIp(answer.address),
    )
  ) {
    throw invalidTarget();
  }

  const selected = answers[0];
  const remainingMs = options.timeoutMs - (Date.now() - startedAt);
  if (remainingMs <= 0) throw requestTimedOut();

  const pinnedLookup: LookupFunction = (_hostname, _lookupOptions, callback) => {
    callback(null, selected.address, selected.family);
  };
  const headers = { ...options.headers };
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === "host") delete headers[key];
  }
  headers.Host = url.host;

  return new Promise<Response>((resolve, reject) => {
    let responseController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let responseResolved = false;
    let finished = false;
    let totalBytes = 0;

    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    };
    const fail = (error: ApiError) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (responseResolved && responseController) {
        responseController.error(error);
      } else {
        reject(error);
      }
    };

    const request = https.request(
      url,
      {
        method: options.method || "GET",
        headers,
        lookup: pinnedLookup,
        family: selected.family,
        agent: false,
        ...(isIP(hostname) ? {} : { servername: hostname }),
      },
      (response) => {
        const status = response.statusCode || 502;
        if (status >= 300 && status < 400) {
          response.resume();
          fail(new ApiError("远程服务重定向已被拒绝", 400));
          request.destroy();
          return;
        }

        if (status < 200 || status > 599) {
          response.destroy();
          fail(requestFailed());
          request.destroy();
          return;
        }

        const declaredLength = Number(response.headers["content-length"] || 0);
        if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
          fail(responseTooLarge());
          response.destroy();
          request.destroy();
          return;
        }

        const responseHeaders = new Headers();
        for (const [name, rawValue] of Object.entries(response.headers)) {
          if (Array.isArray(rawValue)) {
            for (const item of rawValue) responseHeaders.append(name, item);
          } else if (rawValue !== undefined) {
            responseHeaders.set(name, String(rawValue));
          }
        }

        if (status === 204 || status === 205 || status === 304) {
          try {
            const webResponse = new Response(null, {
              status,
              headers: responseHeaders,
            });
            responseResolved = true;
            finished = true;
            cleanup();
            response.destroy();
            resolve(webResponse);
          } catch {
            response.destroy();
            fail(requestFailed());
            request.destroy();
          }
          return;
        }

        response.pause();
        const iterator = response[Symbol.asyncIterator]();
        const body = new ReadableStream<Uint8Array>(
          {
            start(controller) {
              responseController = controller;
            },
            async pull(controller) {
              if (finished) return;
              try {
                const item = await iterator.next();
                if (item.done) {
                  finished = true;
                  cleanup();
                  controller.close();
                  return;
                }
                const buffer = Buffer.isBuffer(item.value)
                  ? item.value
                  : Buffer.from(item.value);
                totalBytes += buffer.length;
                if (totalBytes > options.maxBytes) {
                  fail(responseTooLarge());
                  response.destroy();
                  request.destroy();
                  return;
                }
                controller.enqueue(buffer);
              } catch {
                fail(requestFailed());
                response.destroy();
                request.destroy();
              }
            },
            async cancel() {
              if (finished) return;
              finished = true;
              cleanup();
              await iterator.return?.();
              response.destroy();
              request.destroy();
            },
          },
          { highWaterMark: 0 },
        );

        try {
          const webResponse = new Response(body, {
            status,
            headers: responseHeaders,
          });
          responseResolved = true;
          resolve(webResponse);
        } catch {
          response.destroy();
          fail(requestFailed());
          request.destroy();
        }
      },
    );

    request.on("error", () => fail(requestFailed()));
    const abort = () => {
      fail(requestTimedOut());
      request.destroy();
    };
    const timer = setTimeout(abort, remainingMs);
    if (options.signal?.aborted) {
      abort();
      return;
    }
    options.signal?.addEventListener("abort", abort, { once: true });
    request.end(options.body);
  });
}
