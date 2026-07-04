import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { listAssets, createAsset, ASSET_CATEGORIES, type AssetCategory } from '@/src/agent/assets';

const VALID = ASSET_CATEGORIES.map((c) => c.value);

// GET /api/agente/assets — lista os materiais + categorias disponíveis.
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ assets: await listAssets(), categories: ASSET_CATEGORIES });
  } catch (e) {
    console.error('[api/agente/assets] GET:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}

// POST /api/agente/assets — sobe uma imagem (multipart: file, category, label, caption).
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const form = await req.formData();
    const file = form.get('file');
    const category = String(form.get('category') || 'outro') as AssetCategory;
    const label = String(form.get('label') || '').trim();
    const caption = String(form.get('caption') || '').trim();

    if (!(file instanceof File)) return NextResponse.json({ error: 'imagem obrigatoria' }, { status: 400 });
    if (!label) return NextResponse.json({ error: 'nome (label) obrigatorio' }, { status: 400 });
    if (!VALID.includes(category)) return NextResponse.json({ error: 'categoria invalida' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'envie uma imagem' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'imagem muito grande (max 5MB)' }, { status: 400 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() || file.type.split('/')[1] || 'png').toLowerCase();
    const asset = await createAsset({ category, label, caption, bytes, contentType: file.type, ext });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (e) {
    console.error('[api/agente/assets] POST:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro interno' }, { status: 500 });
  }
}
