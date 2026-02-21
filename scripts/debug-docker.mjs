#!/usr/bin/env node
/**
 * Systematic diagnostic for Docker connection.
 * Run: node scripts/debug-docker.mjs
 * Add evidence at each component boundary to find WHERE it fails.
 */
import fs from "fs";
import path from "path";
import os from "os";

console.log("=== Phase 1: Docker Connection Diagnostic ===\n");

// Layer 1: Environment
console.log("1. ENVIRONMENT");
console.log("   ENABLE_DOCKER_MANAGER:", process.env.ENABLE_DOCKER_MANAGER ?? "(unset)");
console.log("   DOCKER_SOCKET:", process.env.DOCKER_SOCKET ?? "(unset)");
console.log("   Platform:", process.platform);
console.log("   Home:", os.homedir());

// Layer 2: Socket candidates
const candidates = process.env.DOCKER_SOCKET
  ? [path.resolve(process.env.DOCKER_SOCKET)]
  : [
      "/var/run/docker.sock",
      ...(process.platform === "darwin" ? [path.join(os.homedir(), ".docker", "run", "docker.sock")] : []),
    ];

console.log("\n2. SOCKET CANDIDATES");
for (const p of candidates) {
  let exists = false;
  let stat = null;
  let isSocket = false;
  try {
    exists = fs.existsSync(p);
    if (exists) {
      stat = fs.statSync(p);
      isSocket = stat.isSocket();
    }
  } catch (e) {
    console.log(`   ${p}`);
    console.log(`      Error: ${e.message}`);
    continue;
  }
  console.log(`   ${p}`);
  console.log(`      exists: ${exists}, isSocket: ${isSocket}${stat ? `, mode: ${stat.mode.toString(8)}` : ""}`);
}

// Layer 3: Dockerode client creation
console.log("\n3. DOCKERODE CLIENT CREATION");
let Docker;
try {
  const mod = await import("dockerode");
  Docker = mod.default;
  console.log("   dockerode loaded: OK");
} catch (e) {
  console.log("   dockerode load FAILED:", e.message);
  process.exit(1);
}

let client = null;
for (const socketPath of candidates) {
  try {
    client = new Docker({ socketPath });
    console.log(`   new Docker({ socketPath: "${socketPath}" }): OK`);
    break;
  } catch (e) {
    console.log(`   new Docker({ socketPath: "${socketPath}" }): FAILED - ${e.message}`);
  }
}

if (!client) {
  console.log("\n   >>> FAILURE: Could not create Docker client with any candidate");
  process.exit(1);
}

// Layer 4: API call (listContainers)
console.log("\n4. DOCKER API (listContainers)");
try {
  const containers = await client.listContainers({ all: true });
  console.log(`   listContainers({ all: true }): OK, ${containers.length} containers`);
} catch (e) {
  console.log("   listContainers(): FAILED");
  console.log("   code:", e.code);
  console.log("   message:", e.message);
  console.log("   errno:", e.errno);
  process.exit(1);
}

console.log("\n=== All layers OK. Docker connection works. ===");
