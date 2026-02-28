/**
 * Docker client wrapper using dockerode.
 * Used by /api/docker/* routes when ENABLE_DOCKER_MANAGER is set.
 */
import Docker from "dockerode";
import fs from "fs";
import os from "os";
import path from "path";

/** Docker instance or null if unavailable. undefined = not yet tried. */
let docker = undefined;
let dockerError = null;

function resolveSocketPath() {
  if (process.env.DOCKER_SOCKET) {
    return [path.resolve(process.env.DOCKER_SOCKET)];
  }
  const candidates = ["/var/run/docker.sock"];
  if (process.platform === "darwin") {
    candidates.push(path.join(os.homedir(), ".docker", "run", "docker.sock"));
  }
  return candidates;
}

/**
 * Get or create the Docker client. Tries default socket and macOS alternate.
 * @returns {Docker | null} Docker instance or null if unavailable
 */
function getDocker() {
  if (docker !== undefined) return docker;
  const candidates = resolveSocketPath();
  for (const socketPath of candidates) {
    try {
      if (!fs.existsSync(socketPath)) continue;
      const stat = fs.statSync(socketPath);
      if (!stat.isSocket()) continue;
      const client = new Docker({ socketPath });
      docker = client;
      return docker;
    } catch (err) {
      dockerError = err?.message;
      continue;
    }
  }
  console.warn("[docker] Failed to create Docker client. Tried:", candidates.join(", "), "| Error:", dockerError);
  docker = undefined; // Don't cache failure so next request will retry (e.g. after Docker starts)
  return null;
}

/** Reset cached client so next request will retry (e.g. after Docker starts). */
export function resetDockerClient() {
  docker = undefined;
  dockerError = null;
}

/**
 * List containers.
 * @param {{ all?: boolean }} opts - Options. all=true includes stopped containers.
 * @returns {Promise<Array<{ id: string; names: string[]; image: string; status: string; state: string; ports: string; created: string }>>}
 */
const DOCKER_UNAVAILABLE_MSG =
  "Docker is not available. Start Docker Desktop (or the Docker daemon), then refresh. " +
  "If using a custom socket, set DOCKER_SOCKET in your environment.";

export async function listContainers(opts = {}) {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  const all = opts.all === true;
  try {
    const raw = await d.listContainers({ all });
    return raw.map((c) => ({
      id: c.Id,
      names: (c.Names || []).map((n) => n.replace(/^\//, "")),
      image: c.Image || "",
      status: c.Status || "",
      state: c.State || "unknown",
      ports: formatPorts(c.Ports),
      created: c.Created ? new Date(c.Created * 1000).toISOString() : "",
    }));
  } catch (err) {
    if (err?.code === "ECONNREFUSED" || err?.message?.includes("connect")) {
      resetDockerClient();
      throw new Error(DOCKER_UNAVAILABLE_MSG);
    }
    throw err;
  }
}

function formatPorts(ports) {
  if (!ports || !ports.length) return "-";
  return ports
    .map((p) => {
      if (p.PublicPort) return `${p.PublicPort}:${p.PrivatePort}/${p.Type || "tcp"}`;
      return `${p.PrivatePort}/${p.Type || "tcp"}`;
    })
    .join(", ");
}

/**
 * Start a container.
 * @param {string} id - Container ID or name
 */
export async function startContainer(id) {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  const container = d.getContainer(id);
  await container.start();
}

/**
 * Stop a container.
 * @param {string} id - Container ID or name
 */
export async function stopContainer(id) {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  const container = d.getContainer(id);
  await container.stop();
}

/**
 * Restart a container.
 * @param {string} id - Container ID or name
 */
export async function restartContainer(id) {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  const container = d.getContainer(id);
  await container.restart();
}

/**
 * Remove a container.
 * @param {string} id - Container ID or name
 * @param {{ force?: boolean }} opts - force=true to remove running container
 */
export async function removeContainer(id, opts = {}) {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  const container = d.getContainer(id);
  await container.remove({ force: opts.force === true });
}

/**
 * Decode Docker multiplexed log stream (8-byte header + payload).
 * Stream type: 0=stdin, 1=stdout, 2=stderr.
 * Returns null if buffer doesn't look like multiplexed format (e.g. TTY raw output).
 */
function demuxLogBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return null;
  const out = [];
  const err = [];
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const streamType = buffer.readUInt8(offset);
    const payloadSize = buffer.readUInt32BE(offset + 4);
    if (streamType > 2 || payloadSize > 1024 * 1024) return null;
    offset += 8;
    if (offset + payloadSize > buffer.length) break;
    const payload = buffer.subarray(offset, offset + payloadSize).toString("utf8");
    offset += payloadSize;
    if (streamType === 1) out.push(payload);
    else if (streamType === 2) err.push(payload);
  }
  const stdout = out.join("");
  const stderr = err.join("");
  return stdout || stderr ? (stdout && stderr ? `${stdout}\n${stderr}` : stdout || stderr) : null;
}

/**
 * Get container logs (stdout + stderr).
 * @param {string} id - Container ID or name
 * @param {{ tail?: number }} opts - tail=N to limit lines (default 500)
 * @returns {Promise<{ logs: string }>}
 */
export async function getContainerLogs(id, opts = {}) {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  const tail = typeof opts.tail === "number" && opts.tail > 0 ? opts.tail : 500;
  const container = d.getContainer(id);
  let data;
  try {
    data = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      follow: false,
    });
  } catch (err) {
    console.warn("[docker] container.logs failed:", id, err?.message);
    throw err;
  }

  let logs;
  if (Buffer.isBuffer(data)) {
    logs = demuxLogBuffer(data);
    if (logs === null && data.length > 0) {
      logs = data.toString("utf8");
    }
  } else if (typeof data === "string") {
    logs = data;
  } else if (data && typeof data.pipe === "function") {
    const { Writable } = await import("stream");
    const stdoutChunks = [];
    const stderrChunks = [];
    const stdout = new Writable({
      write(chunk, _enc, cb) {
        stdoutChunks.push(chunk);
        cb();
      },
    });
    const stderr = new Writable({
      write(chunk, _enc, cb) {
        stderrChunks.push(chunk);
        cb();
      },
    });
    container.modem.demuxStream(data, stdout, stderr);
    await new Promise((resolve, reject) => {
      data.on("end", resolve);
      data.on("error", reject);
    });
    const out = Buffer.concat(stdoutChunks).toString("utf8");
    const e = Buffer.concat(stderrChunks).toString("utf8");
    logs = out && e ? `${out}\n${e}` : out || e;
  } else {
    logs = "(no logs)";
  }
  return { logs: logs || "(no logs)" };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * List Docker images.
 * @returns {Promise<Array<{ id: string; repoTags: string[]; size: number; created: string }>>}
 */
export async function listImages() {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  try {
    const raw = await d.listImages({ all: true });
    return raw.map((img) => ({
      id: img.Id,
      repoTags: img.RepoTags || [],
      size: img.Size || 0,
      created: img.Created ? new Date(img.Created * 1000).toISOString() : "",
    }));
  } catch (err) {
    if (err?.code === "ECONNREFUSED" || err?.message?.includes("connect")) {
      resetDockerClient();
      throw new Error(DOCKER_UNAVAILABLE_MSG);
    }
    throw err;
  }
}

/**
 * Remove a Docker image.
 * @param {string} id - Image ID or name:tag
 * @param {{ force?: boolean }} opts - force=true to remove even if used
 */
export async function removeImage(id, opts = {}) {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  const image = d.getImage(id);
  await image.remove({ force: opts.force === true });
}

/**
 * Prune unused images. By default prunes dangling (untagged) images only.
 * @param {{ filters?: { dangling?: string[] } }} opts - filters.dangling: ["true"] = dangling only, ["false"] = all unused
 * @returns {Promise<{ ImagesDeleted?: string[]; SpaceReclaimed?: number }>}
 */
export async function pruneImages(opts = {}) {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  return d.pruneImages(opts);
}

// ---------------------------------------------------------------------------
// Volumes
// ---------------------------------------------------------------------------

/**
 * List Docker volumes.
 * @returns {Promise<Array<{ name: string; driver: string; mountpoint: string; created: string }>>}
 */
export async function listVolumes() {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  try {
    const result = await d.listVolumes();
    const vols = result.Volumes || [];
    return vols.map((v) => ({
      name: v.Name || "",
      driver: v.Driver || "local",
      mountpoint: v.Mountpoint || "",
      created: v.CreatedAt || "",
    }));
  } catch (err) {
    if (err?.code === "ECONNREFUSED" || err?.message?.includes("connect")) {
      resetDockerClient();
      throw new Error(DOCKER_UNAVAILABLE_MSG);
    }
    throw err;
  }
}

/**
 * Remove a Docker volume.
 * @param {string} name - Volume name
 */
export async function removeVolume(name) {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  const volume = d.getVolume(name);
  await volume.remove();
}

/**
 * Prune unused volumes (not used by any container).
 * @returns {Promise<{ VolumesDeleted?: string[]; SpaceReclaimed?: number }>}
 */
export async function pruneVolumes() {
  const d = getDocker();
  if (!d) throw new Error(DOCKER_UNAVAILABLE_MSG);
  return d.pruneVolumes();
}
