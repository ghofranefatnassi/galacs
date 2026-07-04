const ODOO_URL = "";

// ─── Commission states valides ────────────────────────────────────────────────
const COMMISSION_STATES = ['calculee', 'validated', 'paid']

async function jsonRpc(endpoint, params) {
  const res = await fetch(`${ODOO_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: Date.now(),
      params,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || "Erreur Odoo");
  return data.result;
}

export async function callModel(model, method, args = [], kwargs = {}) {
  return jsonRpc("/web/dataset/call_kw", { model, method, args, kwargs });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(db, username, password) {
  const result = await jsonRpc("/web/session/authenticate", {
    db,
    login: username,
    password,
  });
  if (!result?.uid) throw new Error("Identifiants invalides");
  return result;
}

export async function logout() {
  await jsonRpc("/web/session/destroy", {});
}

export async function checkIsAgent() {
  const session = JSON.parse(localStorage.getItem("agent_session") || "{}");
  const uid = session.uid;
  if (!uid) throw new Error("Not authenticated");
  const result = await callModel("res.users", "read", [[uid]], {
    fields: ["groups_id"],
  });
  const userGroups = result[0]?.groups_id || [];
  return userGroups.includes(20);
}

// ── Agent profile ─────────────────────────────────────────────────────────────

export async function getAgentProfile() {
  const session = JSON.parse(localStorage.getItem("agent_session") || "{}");
  const uid = session.uid;
  if (!uid) throw new Error("Not authenticated");
  const result = await callModel("res.users", "read", [[uid]], {
    fields: ["name", "email", "phone", "image_1920", "lang", "tz"],
  });
  return result[0];
}

export async function saveAgentProfile(uid, vals) {
  return callModel("res.users", "write", [[uid], vals]);
}

export async function changePassword(oldPassword, newPassword) {
  return jsonRpc("/web/dataset/call_kw", {
    model: "res.users",
    method: "change_password",
    args: [oldPassword, newPassword],
    kwargs: {},
  });
}

export async function getNotifications(uid, limit = 30) {
  return callModel(
    "galacs.notification",
    "search_read",
    [[["recipient_id", "=", uid]]],
    {
      fields: [
        "id", "event_type", "payload",
        "sent_via_bus", "sent_via_email",
        "suppressed_quiet", "create_date",
      ],
      order: "create_date desc",
      limit,
    }
  );
}

// ── Bus / Longpolling ─────────────────────────────────────────────────────────

export function subscribeBus(uid, onMessage) {
  if (process.env.NODE_ENV !== 'production') {
    console.info('[Galacs Bus] Dev mode — longpolling disabled, using polling fallback')
    return () => {}
  }

  let lastId = 0
  let active = true
  const channel = `galacs_agent_${uid}`

  async function poll() {
    if (!active) return
    try {
      const res = await fetch(`${ODOO_URL}/web/longpolling/poll`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          id: Date.now(),
          params: { channels: [channel], last: lastId, options: {} },
        }),
        signal: AbortSignal.timeout(55000),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const messages = data?.result || []

      if (messages.length > 0) {
        lastId = messages[messages.length - 1].id
        messages.forEach((msg) => {
          if (msg.message?.type === 'galacs_notification') {
            onMessage(msg.message.payload)
          }
        })
      }
    } catch (e) {
      if (e.name !== 'AbortError' && e.name !== 'TimeoutError') {
        console.warn('[Galacs Bus] Erreur polling:', e.message)
        await new Promise((r) => setTimeout(r, 5000))
      }
    } finally {
      if (active) setTimeout(poll, 500)
    }
  }

  poll()
  return function stop() { active = false }
}

// ── Enchères ──────────────────────────────────────────────────────────────────

export async function getActiveEncheres() {
  return callModel(
    "galacs.enchere",
    "search_read",
    [[["state", "=", "open"]]],
    {
      fields: [
        "id", "lead_id", "date_start", "date_end", "duration_minutes",
        "current_bid_percent", "min_bid_percent", "bid_count",
        "zone_chalandise", "ia_category", "score_maturity", "state",
      ],
      order: "date_end asc",
    }
  );
}

// ── Leads / Pipeline ──────────────────────────────────────────────────────────

export async function getPipelineLeads() {
  const session = JSON.parse(localStorage.getItem("agent_session") || "{}");
  const uid = session.uid;
  if (!uid) throw new Error("Not authenticated");

  return callModel(
    "crm.lead",
    "search_read",
    [[
      ["user_id", "=", uid],
      ["active", "=", true],
    ]],
    {
      fields: [
        "id", "name", "partner_name", "stage_id",
        "probability", "street", "city",
        "expected_revenue", "date_deadline", "write_date",
        "description",
      ],
      order: "write_date desc",
    }
  );
}

export async function getActiveLeads() {
  const session = JSON.parse(localStorage.getItem("agent_session") || "{}");
  const uid = session.uid;
  if (!uid) throw new Error("Not authenticated");

  return callModel(
    "crm.lead",
    "search_read",
    [[
      ["user_id", "=", uid],
      ["active", "=", true],
      ["probability", "not in", [0, 100]],
    ]],
    {
      fields: [
        "id", "name", "partner_name", "stage_id",
        "probability", "street", "city",
        "expected_revenue", "date_deadline", "write_date",
      ],
      order: "write_date desc",
      limit: 10,
    }
  );
}

export async function updateLeadStage(leadId, stageId) {
  return callModel("crm.lead", "write", [[leadId], { stage_id: stageId }]);
}

export async function logLeadNote(leadId, body) {
  return callModel(
    "crm.lead",
    "message_post",
    [[leadId]],
    {
      body,
      message_type: "comment",
      subtype_xmlid: "mail.mt_note",
    }
  );
}

let _stagesCache = null;
export async function getCrmStages() {
  if (_stagesCache) return _stagesCache;
  _stagesCache = await callModel(
    "crm.stage",
    "search_read",
    [[]],
    { fields: ["id", "name", "sequence"] }
  );
  return _stagesCache;
}

// ── Ventes ────────────────────────────────────────────────────────────────────

export async function getVentesThisMonth() {
  const session = JSON.parse(localStorage.getItem("agent_session") || "{}");
  const uid = session.uid;
  if (!uid) throw new Error("Not authenticated");

  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  return callModel(
    "galacs.vente",
    "search_read",
    [[
      ["agent_id", "=", uid],
      ["date_signature", ">=", firstDay],
      ["state", "in", ["validated", "pending_admin"]],
    ]],
    {
      fields: [
        "id", "lead_id", "reference_bien",
        "acheteur_nom", "vendeur_nom",
        "prix_vente", "date_signature", "state",
      ],
    }
  );
}

export async function declarerVente(vals, files = []) {
  const session = JSON.parse(localStorage.getItem("agent_session") || "{}");
  const uid = session.uid;
  if (!uid) throw new Error("Not authenticated");

  const venteId = await callModel("galacs.vente", "create", [
    {
      agent_id:       uid,
      lead_id:        vals.lead_id,
      date_signature: vals.date_signature,
      reference_bien: vals.reference_bien ?? "",
      acheteur_nom:   vals.acheteur_nom   ?? "",
      vendeur_nom:    vals.vendeur_nom    ?? "",
      prix_vente:     vals.prix_vente     ?? 0,
    },
  ]);

  if (files.length > 0) {
    await Promise.all(files.map((file) => _attachFile(file, "galacs.vente", venteId)));
  }
  await callModel("galacs.vente", "action_submit", [[venteId]]);
  return venteId;
}

async function _attachFile(file, resModel, resId) {
  const base64 = await _fileToBase64(file);
  return callModel("ir.attachment", "create", [
    {
      name:      file.name,
      datas:     base64,
      res_model: resModel,
      res_id:    resId,
      mimetype:  file.type,
    },
  ]);
}

function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error(`Lecture échouée : ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// ── Commissions ───────────────────────────────────────────────────────────────

export async function getCommissionsThisMonth() {
  const session = JSON.parse(localStorage.getItem("agent_session") || "{}");
  const uid = session.uid;
  if (!uid) throw new Error("Not authenticated");

  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const records = await callModel(
    "galacs.commission",
    "search_read",
    [[
      ["agent_id", "=", uid],
      ["create_date", ">=", firstDay],
      ["state", "in", COMMISSION_STATES],
    ]],
    {
      fields: [
        "montant_agent", "montant_galacs", "montant_total",
        "bid_percent", "agent_share_percent", "galacs_share_percent",
        "state",
      ],
    }
  );

  return records.reduce((sum, r) => sum + (r.montant_agent || 0), 0);
}

// ── IA Logs ───────────────────────────────────────────────────────────────────

export async function getIaLogs(leadId) {
  return callModel(
    "galacs.ia.log",
    "search_read",
    [[["lead_id", "=", leadId]]],
    {
      fields: [
        "id", "lead_id", "score", "category",
        "justification", "model_version", "fallback",
        "duration_ms", "create_date",
      ],
      order: "create_date desc",
      limit: 10,
    }
  );
}

// ── External Import ───────────────────────────────────────────────────────────

export async function getExternalImport(leadId) {
  const result = await callModel(
    "galacs.external.import",
    "search_read",
    [[["lead_id", "=", leadId]]],
    {
      fields: [
        "id", "lead_id", "source", "linkedin_url",
        "email", "dedup_blocked", "dropcontact_found", "create_date",
      ],
      limit: 1,
    }
  );
  return result[0] ?? null;
}