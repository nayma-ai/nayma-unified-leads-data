/* INBX dashboard wiring: uses global LeadsAPI (api.js) + Chart.js.
 * appId is fixed to "inbx" — no URL or query params exposed in the UI. */
(function () {
  "use strict";

  var APP_ID = "inbx";
  var LIMIT = 500;

  var $ = function (id) { return document.getElementById(id); };
  var state = { leads: [], charts: {} };
  var PALETTE = [
    "#2563eb", "#7c3aed", "#059669", "#d97706", "#db2777",
    "#0284c7", "#4f46e5", "#65a30d", "#0d9488", "#e11d48",
  ];
  var TICK = "#64748b";
  var GRID = "rgba(100,116,139,.18)";

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function setStatus(kind, msg) {
    var el = $("status");
    el.className = "status " + kind;
    el.textContent = msg;
  }

  function destroyCharts() {
    Object.keys(state.charts).forEach(function (k) {
      try { state.charts[k].destroy(); } catch (e) { /* ignore */ }
    });
    state.charts = {};
  }

  function makeChart(id, type, labels, values) {
    var ctx = $(id);
    if (!ctx || typeof Chart === "undefined") return;
    var colors = labels.map(function (_, i) { return PALETTE[i % PALETTE.length]; });
    state.charts[id] = new Chart(ctx, {
      type: type,
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: type === "line" ? "#2563eb" : colors,
          borderColor: type === "line" ? "#2563eb" : colors,
          borderWidth: type === "doughnut" ? 2 : 0,
          borderColorHover: "#fff",
          fill: false,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: type === "doughnut", labels: { color: TICK, boxWidth: 12 } } },
        scales: type === "doughnut" ? {} : {
          x: {
            ticks: {
              color: TICK, autoSkip: true, maxTicksLimit: 6, maxRotation: 45, minRotation: 0,
              font: { size: 10 },
            },
            grid: { color: GRID },
          },
          y: { beginAtZero: true, ticks: { color: TICK, precision: 0 }, grid: { color: GRID } },
        },
      },
    });
  }

  function topN(arr, n) {
    return (arr || []).slice(0, n || 8);
  }

  function renderAnalytics(leads) {
    var a = window.LeadsAPI.computeAnalytics(leads);
    $("kpiTotal").textContent = a.total;
    $("kpiCities").textContent = a.byCity.length;
    $("kpiCategories").textContent = a.byCategory.length;
    $("kpiTopCity").textContent = a.byCity.length
      ? a.byCity[0].label + " (" + a.byCity[0].count + ")" : "—";
    $("analyticsMeta").textContent = a.total + " leads analysed";

    destroyCharts();
    var city = topN(a.byCity, 8);
    makeChart("chartCity", "bar", city.map(function (x) { return x.label; }), city.map(function (x) { return x.count; }));
    makeChart("chartDate", "line", a.byDate.map(function (x) { return x.label; }), a.byDate.map(function (x) { return x.count; }));
  }

  function fillFilter(select, items) {
    var el = $(select);
    var cur = el.value;
    el.innerHTML = '<option value="">' + (select === "filterCity" ? "All cities" : "All roles") + "</option>" +
      items.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + "</option>"; }).join("");
    if (items.indexOf(cur) !== -1) el.value = cur;
  }

  function filteredLeads() {
    var q = $("search").value.trim().toLowerCase();
    var city = $("filterCity").value;
    var role = $("filterRole").value;
    return state.leads.filter(function (l) {
      if (city && l.city !== city) return false;
      if (role && l.role !== role) return false;
      if (!q) return true;
      return [l.name, l.email, l.phone, l.organization, l.category, l.city]
        .join(" ").toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderTable() {
    var rows = filteredLeads();
    $("countPill").textContent = rows.length + " / " + state.leads.length;
    var tb = $("tbody");
    if (!rows.length) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="8">No leads match the current filters.</td></tr>';
      return;
    }
    tb.innerHTML = rows.map(function (l) {
      var day = (l.submittedAt || l.createdAt || "").slice(0, 10);
      var looking = l.lookingFor.map(function (x) { return '<span class="pill">' + esc(x) + "</span>"; }).join("");
      return "<tr>" +
        '<td data-label="Name"><strong>' + esc(l.name || "(no name)") + "</strong></td>" +
        '<td data-label="Contact">' + esc(l.email) + "<br/><span class='contact-sub'>" + esc(l.phone) + "</span></td>" +
        '<td data-label="City">' + esc(l.city || "—") + "</td>" +
        '<td data-label="Organization">' + esc(l.organization || "—") + "</td>" +
        '<td data-label="Category">' + esc(l.category || "—") + "</td>" +
        '<td data-label="Role">' + esc(l.role || "—") + "<br/><span class='contact-sub'>" + esc(l.heardFrom) + "</span></td>" +
        '<td data-label="Looking for">' + (looking || "<span class='contact-sub'>—</span>") + "</td>" +
        '<td data-label="Captured" class=\'contact-sub\'>' + esc(day) + "</td>" +
        "</tr>";
    }).join("");
  }

  function refreshFilters() {
    var cities = Array.from(new Set(state.leads.map(function (l) { return l.city; }).filter(Boolean))).sort();
    var roles = Array.from(new Set(state.leads.map(function (l) { return l.role; }).filter(Boolean))).sort();
    fillFilter("filterCity", cities);
    fillFilter("filterRole", roles);
  }

  async function load() {
    $("loadBtn").disabled = true;
    setStatus("loading", "Loading INBX leads…");
    try {
      var result = await window.LeadsAPI.fetchLeads({ appId: APP_ID, limit: LIMIT });
      state.leads = result.leads;
      setStatus("ok", "Showing " + result.leads.length + " INBX leads.");
      refreshFilters();
      renderAnalytics(state.leads);
      renderTable();
    } catch (err) {
      setStatus("error", "Could not load leads. Please try again.");
    } finally {
      $("loadBtn").disabled = false;
    }
  }

  function init() {
    ["search", "filterCity", "filterRole"].forEach(function (id) {
      $(id).addEventListener("input", renderTable);
      $(id).addEventListener("change", renderTable);
    });
    $("loadBtn").addEventListener("click", load);
    $("exportBtn").addEventListener("click", function () {
      var rows = filteredLeads();
      if (!rows.length) { setStatus("error", "Nothing to export with current filters."); return; }
      window.LeadsAPI.downloadCsv(rows, "inbx-leads.csv");
    });
    load();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
