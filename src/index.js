export default {
  async fetch(request, env) {
    const ALLOWED_ORIGIN = "https://plataformadoti.com.br";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(ALLOWED_ORIGIN),
      });
    }

    if (request.method === "GET") {
      return new Response("API OK", { status: 200 });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, ALLOWED_ORIGIN);
    }

    const apiKey = request.headers.get("x-api-key") || "";
    if (!env.API_KEY || apiKey !== env.API_KEY) {
      return json({ error: "Forbidden" }, 403, ALLOWED_ORIGIN);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, ALLOWED_ORIGIN);
    }

    const link = String(body?.link || "").trim();
    const tag = String(body?.tag || env.ML_TAG || "").trim();

    if (!link.startsWith("http")) {
      return json({ error: "Invalid link" }, 400, ALLOWED_ORIGIN);
    }
    if (!tag) {
      return json({ error: "Tag not configured" }, 500, ALLOWED_ORIGIN);
    }
    if (!env.ML_COOKIE) {
      return json({ error: "ML cookie not configured" }, 500, ALLOWED_ORIGIN);
    }

    const CREATE_LINK_URL =
      "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink";

    const payload = { urls: [link], tag };

    const resp = await fetch(CREATE_LINK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.mercadolivre.com.br",
        "Referer": "https://www.mercadolivre.com.br/afiliados/linkbuilder",
        "Cookie": env.ML_COOKIE,
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!resp.ok) {
      return json({ error: "ML request failed", status: resp.status, details: data }, resp.status, ALLOWED_ORIGIN);
    }

    const linkAfiliado = findMeliLa(data);
    if (!linkAfiliado) {
      return json({ error: "No affiliate link found", details: data }, 500, ALLOWED_ORIGIN);
    }

    return json({ link_afiliado: linkAfiliado }, 200, ALLOWED_ORIGIN);
  }
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}

function findMeliLa(obj) {
  if (typeof obj === "string") return obj.includes("meli.la/") ? obj : null;
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const r = findMeliLa(it);
      if (r) return r;
    }
    return null;
  }
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj)) {
      const r = findMeliLa(v);
      if (r) return r;
    }
  }
  return null;
}
