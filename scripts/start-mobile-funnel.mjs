#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const serverPort = readServerPort();

async function main() {
  const status = await runJsonCommand(["status", "--json"]);
  if (status.notFound) {
    printLines([
      "Tailscale CLI is not installed or not in PATH.",
      "Install it from: https://tailscale.com/download"
    ]);
    process.exit(1);
  }

  if (!status.payload) {
    printLines([
      "Unable to read Tailscale status.",
      ...(status.errorMessage ? [status.errorMessage] : [])
    ]);
    process.exit(1);
  }

  const backendState = readBackendState(status.payload);
  if (backendState !== "Running") {
    printLines([
      `Tailscale backend is not running (state: ${backendState ?? "unknown"}).`,
      "Start it with:",
      "  tailscale up"
    ]);
    process.exit(1);
  }

  const host = selectReachableTailscaleHost(status.payload);
  if (!host) {
    printLines([
      "Unable to determine a reachable Tailscale host for this machine.",
      "Run `tailscale status --json` and ensure Self.DNSName or Self.TailscaleIPs is present."
    ]);
    process.exit(1);
  }

  const serverUrl = `http://${host}:${serverPort}`;
  console.log(`Using Tailscale server URL: ${serverUrl}`);
  console.log("Ensure the server is running: npm start");

  const child = spawn(
    "npm",
    ["run", "-w", "mobile", "start", "--", "--lan", "--clear"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        EXPO_PUBLIC_SERVER_URL: serverUrl
      }
    }
  );

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    console.error(`Failed to start Expo: ${error.message}`);
    process.exit(1);
  });
}

function readServerPort() {
  const raw = (process.env.SERVER_PORT ?? process.env.PORT ?? "3456").trim();
  const numeric = Number(raw);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65535) {
    return 3456;
  }
  return numeric;
}

async function runJsonCommand(args) {
  try {
    const { stdout } = await execFileAsync("tailscale", args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });

    return {
      notFound: false,
      errorMessage: null,
      payload: JSON.parse(stdout)
    };
  } catch (error) {
    const err = error;

    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return {
        notFound: true,
        errorMessage: "tailscale CLI not found",
        payload: null
      };
    }

    const stderr =
      err && typeof err === "object" && "stderr" in err && typeof err.stderr === "string"
        ? err.stderr.trim()
        : "";
    const stdout =
      err && typeof err === "object" && "stdout" in err && typeof err.stdout === "string"
        ? err.stdout.trim()
        : "";

    if (stdout) {
      try {
        return {
          notFound: false,
          errorMessage: stderr || (err instanceof Error ? err.message : "command failed"),
          payload: JSON.parse(stdout)
        };
      } catch {
        // Fall through to text error return.
      }
    }

    return {
      notFound: false,
      errorMessage: stderr || (err instanceof Error ? err.message : "command failed"),
      payload: null
    };
  }
}

function readBackendState(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return "BackendState" in payload && typeof payload.BackendState === "string"
    ? payload.BackendState
    : null;
}

function selectReachableTailscaleHost(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (!("Self" in payload) || !payload.Self || typeof payload.Self !== "object") {
    return null;
  }

  const self = payload.Self;
  if ("DNSName" in self && typeof self.DNSName === "string" && self.DNSName.trim()) {
    return self.DNSName.replace(/\.$/, "").trim();
  }

  if ("TailscaleIPs" in self && Array.isArray(self.TailscaleIPs)) {
    const ip = self.TailscaleIPs.find((item) => typeof item === "string" && item.trim());
    if (ip) {
      return ip.trim();
    }
  }

  return null;
}

function printLines(lines) {
  for (const line of lines) {
    console.error(line);
  }
}

void main();
