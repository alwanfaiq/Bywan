// Supabase Edge Function: behance-cover
// Mengambil judul + cover project Behance dari kartu embed-nya (server-side, jadi tidak kena CORS).
// Cara pasang: Supabase Dashboard > Edge Functions > Deploy a new function > Via Editor
// Nama function: behance-cover  → paste seluruh isi file ini → Deploy.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const dec = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&trade;/g, "™");
function b64(buf: Uint8Array) {
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^\d{3,12}$/.test(id)) return json({ error: "bad id" }, 400);
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
  const r = await fetch(`https://www.behance.net/embed/project/${id}?ilo0=1`, { headers: { "User-Agent": ua, Accept: "text/html" } });
  if (!r.ok) return json({ error: "upstream " + r.status }, 502);
  const html = await r.text();
  const title = dec((html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").replace(/\s*::\s*Behance\s*$/i, "").trim());
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  const pat = html.match(/https:\/\/[a-z0-9.-]*behance\.net\/[^"'\s)<>\\]*\.(?:jpe?g|png|webp)/gi) || [];
  const any = html.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/gi)?.map((t) => t.match(/src=["']([^"']+)["']/i)![1]).filter((u) => !/pps\.services\.adobe\.com|avatar|profile/i.test(u)) || [];
  const cover = dec(og || pat.find((u) => !/avatar|profile/i.test(u)) || any[0] || "");
  let data = "";
  if (cover) {
    try {
      const ir = await fetch(cover, { headers: { "User-Agent": ua, Referer: "https://www.behance.net/" } });
      if (ir.ok) {
        const buf = new Uint8Array(await ir.arrayBuffer());
        if (buf.length > 0 && buf.length < 4_000_000) data = `data:${ir.headers.get("content-type") || "image/jpeg"};base64,` + b64(buf);
      }
    } catch (_) { /* cover tetap dikembalikan sebagai URL */ }
  }
  return json({ id, title, cover, data });
});
