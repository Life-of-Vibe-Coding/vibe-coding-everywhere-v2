(function () {
  const content = document.getElementById("content");
  const refreshBtn = document.getElementById("refresh");
  const showAllCheck = document.getElementById("showAll");

  function setLoading(loading) {
    refreshBtn.disabled = loading;
  }

  function renderError(message, showDiagnose) {
    let html = '<div class="error">' + escapeHtml(message) + '</div>';
    if (showDiagnose !== false) {
      html += '<div style="margin-top:12px"><button type="button" id="diagnose-btn" class="secondary">Diagnose</button></div>';
      html += '<pre id="diagnose-output" style="display:none;margin-top:12px;padding:12px;background:#161b22;border-radius:8px;font-size:12px;overflow:auto;max-height:300px"></pre>';
    }
    content.innerHTML = html;
    const btn = document.getElementById("diagnose-btn");
    if (btn) {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const out = document.getElementById("diagnose-output");
        try {
          const res = await fetch("/api/docker/diagnostic");
          const data = await res.json();
          out.textContent = JSON.stringify(data, null, 2);
          out.style.display = "block";
        } catch (e) {
          out.textContent = "Diagnostic failed: " + (e?.message || String(e));
          out.style.display = "block";
        }
        btn.disabled = false;
      });
    }
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  async function fetchContainers() {
    const all = showAllCheck.checked;
    const res = await fetch("/api/docker/containers?all=" + (all ? "true" : "false"));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Failed to fetch containers");
    }
    return data.containers || [];
  }

  function statusClass(state) {
    const s = (state || "").toLowerCase();
    if (s.includes("running")) return "running";
    if (s.includes("exited") || s.includes("dead")) return "exited";
    if (s.includes("paused")) return "paused";
    return "unknown";
  }

  function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString();
  }

  async function action(id, op, label) {
    if (op === "remove" && !confirm("Remove this container?")) return;
    setLoading(true);
    try {
      let res;
      if (op === "remove") {
        res = await fetch("/api/docker/containers/" + encodeURIComponent(id) + "?force=true", { method: "DELETE" });
      } else {
        res = await fetch("/api/docker/containers/" + encodeURIComponent(id) + "/" + op, { method: "POST" });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to " + label);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function renderTable(containers) {
    if (containers.length === 0) {
      return '<div class="loading">No containers found.</div>';
    }
    let html = '<div class="table-wrap"><table><thead><tr>';
    html += '<th>Name</th><th>Image</th><th>Status</th><th>Ports</th><th>Created</th><th>Actions</th></tr></thead><tbody>';
    for (const c of containers) {
      const names = (c.names || []).join(", ") || c.id?.slice(0, 12) || "-";
      const isRunning = (c.state || "").toLowerCase().includes("running");
      html += "<tr>";
      html += "<td>" + escapeHtml(names) + "</td>";
      html += "<td>" + escapeHtml(c.image || "-") + "</td>";
      html += '<td><span class="status ' + statusClass(c.state) + '">' + escapeHtml(c.status || "-") + "</span></td>";
      html += "<td>" + escapeHtml(c.ports || "-") + "</td>";
      html += "<td>" + formatDate(c.created) + "</td>";
      html += '<td class="actions">';
      if (!isRunning) {
        html += '<button type="button" data-id="' + escapeHtml(c.id) + '" data-op="start">Start</button>';
      } else {
        html += '<button type="button" data-id="' + escapeHtml(c.id) + '" data-op="stop">Stop</button>';
        html += '<button type="button" data-id="' + escapeHtml(c.id) + '" data-op="restart">Restart</button>';
      }
      html += '<button type="button" class="danger" data-id="' + escapeHtml(c.id) + '" data-op="remove">Remove</button>';
      html += "</td></tr>";
    }
    html += "</tbody></table></div>";
    return html;
  }

  async function load() {
    setLoading(true);
    content.innerHTML = '<div class="loading">Loading...</div>';
    try {
      const containers = await fetchContainers();
      content.innerHTML = renderTable(containers);
      content.querySelectorAll("button[data-id][data-op]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          const op = btn.dataset.op;
          const labels = { start: "start", stop: "stop", restart: "restart", remove: "remove" };
          action(id, op, labels[op] || op);
        });
      });
    } catch (err) {
      renderError(err.message, true);
    } finally {
      setLoading(false);
    }
  }

  refreshBtn.addEventListener("click", load);
  showAllCheck.addEventListener("change", load);
  load();
})();
