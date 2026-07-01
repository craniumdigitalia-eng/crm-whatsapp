import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getEmailAutomation, setEmailAutomation } from "@/src/crm/email-automation";
import { STATUS_LABELS } from "@/src/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Conjunto de estágios válidos do funil.
const ESTAGIOS_VALIDOS = new Set(Object.keys(STATUS_LABELS));

// GET /api/email/automation — retorna a config atual de automação.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await getEmailAutomation());
  } catch (e) {
    console.error("[api/email/automation] GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erro interno" },
      { status: 500 }
    );
  }
}

// POST /api/email/automation — grava a config de automação.
// Body: { enabled: boolean, map: Record<string, string> }
//   map: chaves devem ser estágios válidos (LeadStatus); valores = template_id (string, pode ser "").
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "body inválido" }, { status: 400 });
    }
    const raw = body as Record<string, unknown>;

    // Valida enabled.
    if (typeof raw.enabled !== "boolean") {
      return NextResponse.json({ error: "'enabled' deve ser boolean" }, { status: 400 });
    }

    // Valida map.
    if (typeof raw.map !== "object" || raw.map === null || Array.isArray(raw.map)) {
      return NextResponse.json({ error: "'map' deve ser um objeto" }, { status: 400 });
    }
    const mapRaw = raw.map as Record<string, unknown>;
    const map: Record<string, string> = {};
    for (const [chave, valor] of Object.entries(mapRaw)) {
      if (!ESTAGIOS_VALIDOS.has(chave)) {
        return NextResponse.json(
          { error: `estágio inválido em map: "${chave}"` },
          { status: 400 }
        );
      }
      if (typeof valor !== "string") {
        return NextResponse.json(
          { error: `valor do estágio "${chave}" deve ser string` },
          { status: 400 }
        );
      }
      map[chave] = valor;
    }

    const cfg = { enabled: raw.enabled, map };
    await setEmailAutomation(cfg);
    return NextResponse.json(cfg);
  } catch (e) {
    console.error("[api/email/automation] POST:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "erro interno" },
      { status: 500 }
    );
  }
}
