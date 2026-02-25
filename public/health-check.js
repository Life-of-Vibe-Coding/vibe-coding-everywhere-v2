(function () {
  const statusEl = document.getElementById("status");
  const messageEl = document.getElementById("message");
  const systemRows = document.getElementById("systemRows");
  const sessionsContent = document.getElementById("sessionsContent");
  const sessionManagementStoreContent = document.getElementById("sessionManagementStoreContent");
  const processContent = document.getElementById("processContent");
  const refreshBtn = document.getElementById("refresh");
  const autoRefresh = document.getElementById("autoRefresh");

  function nowTime() {
    return new Date().toLocaleTimeString();
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setMessage(text) {
    if (text) {
      messageEl.style.display = "block";
      messageEl.textContent = text;
      messageEl.className = "loading";
    } else {
      messageEl.style.display = "none";
      messageEl.textContent = "";
    }
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function fmtMb(value) {
    if (!Number.isFinite(value) || value < 0) return "n/a";
    return `${Number(value).toFixed(1)} MB`;
  }

  function fmtUptime(sec) {
    if (!Number.isFinite(sec) || sec <= 0) return "n/a";
    const m = Math.floor(sec / 60);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h > 0) return `${h}h ${mm}m`;
    return `${mm}m`;
  }

  function fmtLastAccess(ts) {
    if (!Number.isFinite(ts)) return "n/a";
    const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diff < 60) return `${diff}s ago`;
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return `${h}h ${r}m ago`;
  }

  function fmtBoolean(value) {
    if (typeof value !== "boolean") return "n/a";
    return value ? "Yes" : "No";
  }

  function addRow(label, value, className) {
    const row = document.createElement("div");
    row.className = "row";
    const labelEl = document.createElement("div");
    labelEl.className = "label";
    labelEl.textContent = label;
    const valueEl = document.createElement("div");
    valueEl.className = `value${className ? ` ${className}` : ""}`;
    valueEl.textContent = value;
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `Request failed (${res.status})`);
    }
    if (!text.trim()) return {};
    return JSON.parse(text);
  }

  function renderSystemSection(data, dockerEnabled) {
    clearNode(systemRows);
    const rows = [];
    const connected = "Connected";
    rows.push(addRow("Health endpoint", data?.status || "Unavailable", data?.ok ? "good" : "bad"));
    rows.push(addRow("Checked", data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "n/a"));
    rows.push(addRow("Node", data?.system?.nodeVersion || "—"));
    rows.push(addRow("Platform", `${data?.system?.platform || "—"} / ${data?.system?.arch || "—"}`));
    rows.push(addRow("Uptime", fmtUptime(data?.system?.uptimeSeconds)));
    rows.push(addRow(
      "Memory",
      `${fmtMb(data?.system?.memory?.rss)} RSS / ${fmtMb(data?.system?.memory?.heapUsed)} heap`
    ));
    rows.push(addRow("Workspace", data?.workspace?.path || "—"));
    const dockerStatus = dockerEnabled == null ? "Unknown" : (dockerEnabled ? "Enabled" : "Disabled");
    rows.push(addRow("Docker", dockerStatus, dockerEnabled ? "good" : dockerEnabled === false ? "warn" : ""));
    const socketLabel = addRow("Connection", connected, "good");
    systemRows.appendChild(socketLabel);
    rows.forEach((r) => systemRows.appendChild(r));
  }

  function renderSessionManagementStoreSection(data) {
    clearNode(sessionManagementStoreContent);

    if (!data || !data.ok) {
      const reason = data?.reason ? ` (${data.reason})` : "";
      sessionManagementStoreContent.innerHTML = `<div class="loading">No session-management store snapshot available${reason}.</div>`;
      return;
    }

    const snapshot = data.snapshot || {};
    const sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
    const sessionManagement = snapshot.sessionManagement || {};

    const wrapper = document.createElement("div");
    [
      ["Current session id", snapshot.currentSessionId || "—"],
      ["Session id", snapshot.sessionId || "—"],
      ["Provider", snapshot.provider || "—"],
      ["Model", snapshot.model || "—"],
      ["Path", snapshot.path || snapshot.workspacePath || "—"],
      ["Connected", fmtBoolean(snapshot.connected)],
      ["Session statuses", typeof snapshot.count === "number" ? String(snapshot.count) : String(sessions.length)],
      ["SM modal visible", fmtBoolean(sessionManagement.visible)],
      ["SM active provider", sessionManagement.currentProvider || "—"],
      ["SM active model", sessionManagement.currentModel || "—"],
      ["SM active session id", sessionManagement.activeSessionId || "—"],
      ["Last received", snapshot.receivedAt ? new Date(snapshot.receivedAt).toLocaleString() : "—"],
    ].forEach(([label, value]) => {
      wrapper.appendChild(addRow(label, value));
    });

    if (sessions.length) {
      const sessionsTitle = document.createElement("h3");
      sessionsTitle.textContent = "Session statuses";
      sessionsTitle.style.margin = "10px 0 8px";
      wrapper.appendChild(sessionsTitle);

      const tableWrap = document.createElement("div");
      tableWrap.className = "table-wrap";
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      thead.innerHTML = "<tr><th>ID</th><th>Status</th><th>Model</th><th>Last access</th><th>Workspace</th></tr>";
      const tbody = document.createElement("tbody");
      sessions.slice(0, 6).forEach((session) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${(session.id || "").slice(0, 8) || "—"}</td><td>${session.status || "unknown"}</td><td>${session.model || "—"}</td><td>${fmtLastAccess(session.lastAccess)}</td><td>${session.cwd || "—"}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      wrapper.appendChild(tableWrap);
    } else {
      wrapper.appendChild(Object.assign(document.createElement("div"), { className: "loading", textContent: "No session entries in snapshot." }));
    }

    const raw = document.createElement("pre");
    raw.className = "json";
    raw.textContent = JSON.stringify(snapshot, null, 2);
    wrapper.appendChild(raw);

    sessionManagementStoreContent.appendChild(wrapper);
  }

  function renderSessionsSection(data) {
    clearNode(sessionsContent);
    const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
    if (!sessions.length) {
      sessionsContent.innerHTML = '<div class="loading">No sessions available.</div>';
      return;
    }
    const rows = sessions.slice(0, 8);
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>ID</th><th>Status</th><th>Model</th><th>Last access</th><th>Workspace</th></tr>";
    const tbody = document.createElement("tbody");
    rows.forEach((s) => {
      const tr = document.createElement("tr");
      const shortId = (s.id || "").slice(0, 8) || "—";
      tr.innerHTML = `<td>${shortId}</td><td>${s.status || "unknown"}</td><td>${s.model || "—"}</td><td>${fmtLastAccess(s.lastAccess)}</td><td>${s.cwd || "—"}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    wrapper.appendChild(table);
    sessionsContent.appendChild(wrapper);
  }

  function renderProcessSection(processes) {
    clearNode(processContent);
    const list = Array.isArray(processes?.processes) ? processes.processes : [];
    if (!list.length) {
      processContent.innerHTML = '<div class="loading">No process records available.</div>';
      return;
    }
    const topRows = list.slice(0, 8);
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>PID</th><th>Port</th><th>Command</th></tr>";
    const tbody = document.createElement("tbody");
    topRows.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${p.pid ?? "—"}</td><td>${p.port ?? "—"}</td><td>${p.command || "—"}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    wrapper.appendChild(table);
    processContent.appendChild(wrapper);
  }

  function setWarnings(healthResponse, processResponse, sessionResponse, dockerResponse, sessionStoreResponse) {
    const warnings = [];
    if (!healthResponse.ok) warnings.push(`Health API: ${healthResponse.error}`);
    if (!processResponse.ok) warnings.push(`Processes API: ${processResponse.error}`);
    if (!sessionResponse.ok) warnings.push(`Sessions API: ${sessionResponse.error}`);
    if (!dockerResponse.ok) warnings.push(`Docker API: ${dockerResponse.error}`);
    if (!sessionStoreResponse.ok) warnings.push(`Session management store API: ${sessionStoreResponse.error}`);
    if (!warnings.length) {
      setMessage("");
      return;
    }
    setMessage(`Warnings: ${warnings.join(" | ")}`);
  }

  async function load() {
    refreshBtn.disabled = true;
    setStatus(`Checking… ${nowTime()}`);
    const health = {
      ok: false,
      error: "unknown",
      payload: null,
      data: null,
    };

    const processes = {
      ok: false,
      error: "unknown",
      data: null,
    };

    const sessions = {
      ok: false,
      error: "unknown",
      data: null,
    };

    const docker = {
      ok: false,
      error: "unknown",
      data: null,
    };

    const sessionStore = {
      ok: false,
      error: "unknown",
      data: null,
    };

    try {
      const [h, p, s, d, sm] = await Promise.allSettled([
        fetchJson("/api/health"),
        fetchJson("/api/processes"),
        fetchJson("/api/sessions/status"),
        fetchJson("/api/docker/status"),
        fetchJson("/api/session-management-store"),
      ]);

      if (h.status === "fulfilled") {
        health.ok = true;
        health.data = h.value;
      } else {
        health.error = h.reason?.message || "Failed";
      }

      if (p.status === "fulfilled") {
        processes.ok = true;
        processes.data = p.value;
      } else {
        processes.error = p.reason?.message || "Failed";
      }

      if (s.status === "fulfilled") {
        sessions.ok = true;
        sessions.data = s.value;
      } else {
        sessions.error = s.reason?.message || "Failed";
      }

      if (d.status === "fulfilled") {
        docker.ok = true;
        docker.data = d.value;
      } else {
        docker.error = d.reason?.message || "Failed";
      }

      if (sm.status === "fulfilled") {
        if (sm.value && sm.value.ok === false) {
          sessionStore.error = sm.value.reason || "No session-management store snapshot";
          sessionStore.data = sm.value;
        } else {
          sessionStore.ok = true;
          sessionStore.data = sm.value;
        }
      } else {
        sessionStore.error = sm.reason?.message || "Failed";
      }

      setWarnings(
        health.ok ? { ok: true } : { ok: false, error: health.error },
        processes.ok ? { ok: true } : { ok: false, error: processes.error },
        sessions.ok ? { ok: true } : { ok: false, error: sessions.error },
        docker.ok ? { ok: true } : { ok: false, error: docker.error },
        sessionStore.ok ? { ok: true } : { ok: false, error: sessionStore.error }
      );

      renderSystemSection(health.data || {}, docker.data?.enabled);
      if (sessions.ok) renderSessionsSection(sessions.data);
      if (processes.ok) renderProcessSection(processes.data);
      renderSessionManagementStoreSection(sessionStore.ok ? sessionStore.data : { ok: false, reason: sessionStore.error, snapshot: null });
    } catch (e) {
      setMessage(`Failed to load health data: ${e?.message || e}`);
      renderSystemSection({}, false);
      sessionsContent.innerHTML = '<div class="loading">Unable to load sessions.</div>';
      processContent.innerHTML = '<div class="loading">Unable to load processes.</div>';
      sessionManagementStoreContent.innerHTML = '<div class="loading">Unable to load session management store.</div>';
    } finally {
      refreshBtn.disabled = false;
      setStatus(`Last updated ${nowTime()}`);
    }
  }

  let timer = null;

  function startAutoRefresh() {
    if (timer) clearInterval(timer);
    if (!autoRefresh.checked) return;
    timer = setInterval(load, 10000);
  }

  refreshBtn.addEventListener("click", () => {
    void load();
  });
  autoRefresh.addEventListener("change", () => {
    startAutoRefresh();
  });

  void load();
  startAutoRefresh();
})();
