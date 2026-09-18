/* Leads API client for nayma-unified-leads-data.
 * Works on GitHub Pages (static, no build step). Wraps the Cloud Run endpoint:
 *   GET {baseUrl}/?appId=<appId>&limit=<limit>
 * Response shape: { appId, count, limit, data: [...] }
 */
(function (global) {
  "use strict";

  var DEFAULT_API_BASE =
    "https://nayma-unified-leads-data-795256461991.me-central1.run.app";

  function buildLeadsUrl(baseUrl, appId, limit) {
    var base = (baseUrl || DEFAULT_API_BASE).replace(/\/+$/, "");
    var params = new URLSearchParams();
    params.set("appId", String(appId || "").trim());
    if (limit !== undefined && limit !== null && String(limit).trim() !== "") {
      params.set("limit", String(limit).trim());
    }
    return base + "/?" + params.toString();
  }

  function normalizeLead(raw) {
    raw = raw || {};
    var meta = raw.metadata || {};
    return {
      id: raw.id || "",
      appId: raw.appId || "",
      name: raw.name || "",
      email: raw.email || "",
      phone: raw.phone || "",
      source: raw.source || "",
      createdAt: raw.createdAt || "",
      submittedAt: meta.submittedAt || raw.createdAt || "",
      city: clean(meta.city),
      organization: clean(meta.organization),
      category: clean(meta.category),
      role: clean(meta.role),
      heardFrom: clean(meta.heardFrom),
      lookingFor: Array.isArray(meta.lookingFor)
        ? meta.lookingFor.map(clean).filter(Boolean)
        : [],
      note: meta.note ? String(meta.note) : "",
      raw: raw,
    };
  }

  function clean(v) {
    return String(v === undefined || v === null ? "" : v).trim();
  }

  async function fetchLeads(options) {
    options = options || {};
    var baseUrl = options.baseUrl || DEFAULT_API_BASE;
    var appId = String(options.appId || "").trim();
    var limit = options.limit;

    if (!appId) throw new Error("appId is required");
    var n = Number(limit);
    if (limit !== undefined && limit !== "" && (!Number.isFinite(n) || n <= 0)) {
      throw new Error("limit must be a positive number");
    }
    if (n > 1000) throw new Error("limit must be <= 1000");

    var url = buildLeadsUrl(baseUrl, appId, limit === "" ? undefined : limit);
    var res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      var text = "";
      try {
        text = await res.text();
      } catch (e) {
        /* ignore */
      }
      throw new Error("API request failed (" + res.status + "): " + text.slice(0, 200));
    }
    var json = await res.json();
    var rows = Array.isArray(json.data) ? json.data : [];
    return {
      appId: json.appId || appId,
      count: typeof json.count === "number" ? json.count : rows.length,
      limit: json.limit !== undefined ? json.limit : limit,
      leads: rows.map(normalizeLead),
      raw: json,
    };
  }

  function countBy(leads, getKey) {
    var map = {};
    leads.forEach(function (l) {
      var keys = getKey(l);
      if (!Array.isArray(keys)) keys = [keys];
      keys.forEach(function (k) {
        k = clean(k) || "(unknown)";
        map[k] = (map[k] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(function (e) {
        return { label: e[0], count: e[1] };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });
  }

  function computeAnalytics(leads) {
    var byDateMap = {};
    leads.forEach(function (l) {
      var d = l.submittedAt || l.createdAt || "";
      var day = d ? String(d).slice(0, 10) : "(unknown)";
      byDateMap[day] = (byDateMap[day] || 0) + 1;
    });
    var byDate = Object.entries(byDateMap)
      .map(function (e) {
        return { label: e[0], count: e[1] };
      })
      .sort(function (a, b) {
        return a.label < b.label ? -1 : 1;
      });
    return {
      total: leads.length,
      byCity: countBy(leads, function (l) {
        return l.city;
      }),
      byRole: countBy(leads, function (l) {
        return l.role;
      }),
      byCategory: countBy(leads, function (l) {
        return l.category;
      }),
      byHeardFrom: countBy(leads, function (l) {
        return l.heardFrom;
      }),
      byLookingFor: countBy(leads, function (l) {
        return l.lookingFor;
      }),
      byDate: byDate,
    };
  }

  function toCsvValue(v) {
    v = v === undefined || v === null ? "" : String(v);
    if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  function leadsToCsv(leads) {
    var header = [
      "id",
      "appId",
      "name",
      "email",
      "phone",
      "city",
      "organization",
      "category",
      "role",
      "heardFrom",
      "lookingFor",
      "source",
      "submittedAt",
      "createdAt",
    ];
    var lines = [header.join(",")];
    leads.forEach(function (l) {
      lines.push(
        [
          l.id,
          l.appId,
          l.name,
          l.email,
          l.phone,
          l.city,
          l.organization,
          l.category,
          l.role,
          l.heardFrom,
          l.lookingFor.join(" | "),
          l.source,
          l.submittedAt,
          l.createdAt,
        ]
          .map(toCsvValue)
          .join(",")
      );
    });
    return lines.join("\n");
  }

  function downloadCsv(leads, filename) {
    var csv = leadsToCsv(leads);
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "leads.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  global.LeadsAPI = {
    DEFAULT_API_BASE: DEFAULT_API_BASE,
    buildLeadsUrl: buildLeadsUrl,
    fetchLeads: fetchLeads,
    normalizeLead: normalizeLead,
    computeAnalytics: computeAnalytics,
    leadsToCsv: leadsToCsv,
    downloadCsv: downloadCsv,
  };
})(window);
