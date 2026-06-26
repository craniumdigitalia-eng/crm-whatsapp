import { parseCsv, isValidEmail, injectTracking } from "./email";
import { verifyClick, verifyUnsub } from "./email-sign";

// Funções puras do módulo de Email Marketing (sem acesso a banco).
describe("isValidEmail", () => {
  it("aceita emails válidos e rejeita lixo", () => {
    expect(isValidEmail("ana@cranium.com")).toBe(true);
    expect(isValidEmail("ana+promo@sub.dominio.com.br")).toBe(true);
    expect(isValidEmail("sem-arroba")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("parseCsv", () => {
  it("usa cabeçalho email/name em qualquer ordem", () => {
    const out = parseCsv("name,email\nJoão Silva,joao@x.com\nMaria,maria@y.com");
    expect(out).toEqual([
      { email: "joao@x.com", name: "João Silva" },
      { email: "maria@y.com", name: "Maria" },
    ]);
  });

  it("sem cabeçalho: 1ª coluna email, 2ª nome", () => {
    const out = parseCsv("carlos@x.com,Carlos\nlucia@y.com");
    expect(out).toEqual([
      { email: "carlos@x.com", name: "Carlos" },
      { email: "lucia@y.com", name: null },
    ]);
  });

  it("aceita ponto-e-vírgula e aspas, normaliza email para minúsculas", () => {
    const out = parseCsv('email;nome\n"ANA@X.COM";"Ana Lima"');
    expect(out).toEqual([{ email: "ana@x.com", name: "Ana Lima" }]);
  });

  it("descarta linhas sem email válido e linhas vazias", () => {
    const out = parseCsv("email,name\nvalido@x.com,Ok\nsem-email,Ruim\n\n");
    expect(out).toEqual([{ email: "valido@x.com", name: "Ok" }]);
  });
});

describe("injectTracking", () => {
  const html = '<html><body><p>Oi</p><a href="https://cranium.com/promo">Ver</a></body></html>';

  it("reescreve links e injeta o pixel antes de </body>", () => {
    const out = injectTracking(html, "camp1", "ana@x.com", "https://app.cranium.com");
    // Link reescrito para o redirect de click com a URL original encodada.
    expect(out).toContain(
      "https://app.cranium.com/api/email/track/click?c=camp1&e=ana%40x.com&u=" +
        encodeURIComponent("https://cranium.com/promo")
    );
    // Pixel de open inserido antes do fechamento do body.
    expect(out).toContain(
      '<img src="https://app.cranium.com/api/email/track/open?c=camp1&e=ana%40x.com"'
    );
    expect(out.indexOf("track/open")).toBeLessThan(out.indexOf("</body>"));
  });

  it("sem baseUrl absoluto, devolve o HTML intacto", () => {
    expect(injectTracking(html, "camp1", "ana@x.com", "")).toBe(html);
  });

  it("não mexe em mailto: nem âncoras", () => {
    const h = '<body><a href="mailto:x@y.com">mail</a><a href="#topo">topo</a></body>';
    const out = injectTracking(h, "c", "e@x.com", "https://app.x.com");
    expect(out).toContain('href="mailto:x@y.com"');
    expect(out).toContain('href="#topo"');
  });

  it("assina a URL de destino do click (E3) — sig válida e verificável", () => {
    const url = "https://cranium.com/promo";
    const out = injectTracking(html, "camp1", "ana@x.com", "https://app.cranium.com");
    const m = out.match(/track\/click\?c=camp1&e=ana%40x\.com&u=([^"&]+)&sig=([a-f0-9]+)/);
    expect(m).not.toBeNull();
    const [, u, sig] = m as RegExpMatchArray;
    expect(decodeURIComponent(u)).toBe(url);
    // A assinatura confere para (campaign, email, url) — e falha se a URL muda.
    expect(verifyClick("camp1", "ana@x.com", url, sig)).toBe(true);
    expect(verifyClick("camp1", "ana@x.com", "https://evil.com", sig)).toBe(false);
  });

  it("injeta rodapé de descadastro assinado (E0)", () => {
    const out = injectTracking(html, "camp1", "ana@x.com", "https://app.cranium.com");
    expect(out).toContain("/api/email/unsubscribe?c=camp1&e=ana%40x.com&sig=");
    const m = out.match(/unsubscribe\?c=camp1&e=ana%40x\.com&sig=([a-f0-9]+)/);
    expect(m).not.toBeNull();
    expect(verifyUnsub("camp1", "ana@x.com", (m as RegExpMatchArray)[1])).toBe(true);
  });
});
