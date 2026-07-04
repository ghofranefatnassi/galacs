const ODOO_URL = "";

// ─── Core JSON-RPC ────────────────────────────────────────────────────────────
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

// ─── Auth ─────────────────────────────────────────────────────────────────────
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

// ─── Generic model caller ─────────────────────────────────────────────────────
export async function callModel(model, method, args = [], kwargs = {}) {
  return jsonRpc("/web/dataset/call_kw", { model, method, args, kwargs });
}

// ─── Admin check ──────────────────────────────────────────────────────────────
// Returns true only if the currently logged-in user has full admin rights
export async function checkIsAdmin() {
  const session = JSON.parse(localStorage.getItem("odoo_session") || "{}");
  const uid = session.uid;
  if (!uid) throw new Error("Not authenticated");

  const result = await callModel("res.users", "read", [[uid]], {
    fields: ["groups_id"],
  });
  const userGroups = result[0]?.groups_id || [];
  return userGroups.includes(21); // ← replace with id from shell
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export async function getAdminProfile() {
  const session = JSON.parse(localStorage.getItem("odoo_session") || "{}");
  const uid = session.uid;
  const partnerId = session.partner_id;
  if (!uid) throw new Error("Not authenticated");

  // Read directly from res.partner using partner_id from session
  const partnerResult = await callModel("res.partner", "read", [[partnerId]], {
    fields: ["name", "email", "phone", "image_1920"],
  });
  const p = partnerResult[0];

  // Read user-specific fields
  const userResult = await callModel("res.users", "read", [[uid]], {
    fields: ["lang", "tz", "company_id"],
  });
  const u = userResult[0];

  return {
    name: p.name || session.name || '',
    email: session.username || p.email || '',  // username = login email
    phone: p.phone || '',
    image_1920: p.image_1920 || null,
    lang: u.lang,
    tz: u.tz,
    company_id: u.company_id,
    partner_id: [partnerId, session.partner_display_name],
    uid,
  };
}
export async function getActiveEncheres() {
  return callModel(
    "galacs.enchere",
    "search_read",
    [[["state", "=", "open"]]],
    {
      fields: [
        "lead_id", "date_end", "bid_count",
        "current_bid_percent", "zone_chalandise", "ia_category", "score_maturity"
      ],
      order: "date_end asc",   // enchère la plus proche en premier
    }
  );
}
export async function saveAdminProfile(uid, vals) {
  // Step 1 — get partner_id
  const userResult = await callModel("res.users", "read", [[uid]], {
    fields: ["partner_id"],
  });
  const partnerId = userResult[0]?.partner_id?.[0];

  // Step 2 — write contact fields on res.partner
  if (partnerId) {
    const partnerVals = {};
    if (vals.name)       partnerVals.name       = vals.name;
    if (vals.email)      partnerVals.email      = vals.email;
    if (vals.phone)      partnerVals.phone      = vals.phone;
    if (vals.image_1920) partnerVals.image_1920 = vals.image_1920;
    await callModel("res.partner", "write", [[partnerId], partnerVals]);
  }

  // Step 3 — write user-specific fields on res.users
  const userVals = {};
  if (vals.lang) userVals.lang = vals.lang;
  if (vals.tz)   userVals.tz   = vals.tz;
  if (Object.keys(userVals).length > 0) {
    await callModel("res.users", "write", [[uid], userVals]);
  }

  return true;
}

// ─── Password ─────────────────────────────────────────────────────────────────
export async function changePassword(oldPassword, newPassword) {
  return jsonRpc("/web/dataset/call_kw", {
    model: "res.users",
    method: "change_password",
    args: [oldPassword, newPassword],
    kwargs: {},
  });
}

// ─── Generic helpers ──────────────────────────────────────────────────────────
export const odoo = {
  // odoo.search("res.partner", [["is_company","=",true]], ["name","email"])
  async search(model, domain = [], fields = [], limit = 80) {
    return callModel(model, "search_read", [domain], { fields, limit });
  },

  // odoo.create("res.partner", { name: "Test" })
  async create(model, vals) {
    return callModel(model, "create", [vals]);
  },

  // odoo.write("res.partner", [id], { name: "New Name" })
  async write(model, ids, vals) {
    return callModel(model, "write", [ids, vals]);
  },

  // odoo.unlink("res.partner", [id])
  async unlink(model, ids) {
    return callModel(model, "unlink", [ids]);
  },

  // odoo.count("res.partner", [["is_company","=",true]])
  async count(model, domain = []) {
    return callModel(model, "search_count", [domain]);
  },
  
};
// ─── Bus / Longpolling (Admin) ────────────────────────────────────────────────
export function subscribeBus(uid, onMessage) {
  if (process.env.NODE_ENV !== 'production') {
    console.info('[Galacs Bus] Dev mode — longpolling disabled, using polling fallback')
    return () => {}
  }

  let lastId = 0
  let active = true
  const channel = `galacs_admin_${uid}`

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
// fetch all Agent Immobilier users (group id=19)
export async function getAgentImmobilierUsers() {
  // Get all user IDs in group 19 (Agent Immobilier)
  const groups = await callModel("res.groups", "read", [[20]], {
    fields: ["users"],
  });
  const userIds = groups[0]?.users || [];
  if (userIds.length === 0) return [];

  // Fetch their details
  return callModel("res.users", "read", [userIds], {
    fields: ["name", "email", "phone", "image_1920", "active", "groups_id"],
  });
}
