import { signClick, verifyClick, signUnsub, verifyUnsub } from "./email-sign";

// Assinatura HMAC dos links de email (QA E0/E3).
describe("email-sign", () => {
  it("click: assina e verifica o mesmo (campaign,email,url)", () => {
    const sig = signClick("c1", "ana@x.com", "https://site.com/a");
    expect(verifyClick("c1", "ana@x.com", "https://site.com/a", sig)).toBe(true);
  });

  it("click: rejeita se a URL de destino foi adulterada (anti open-redirect)", () => {
    const sig = signClick("c1", "ana@x.com", "https://site.com/a");
    expect(verifyClick("c1", "ana@x.com", "https://evil.com", sig)).toBe(false);
  });

  it("click: rejeita se campaign/email mudam ou sig ausente", () => {
    const sig = signClick("c1", "ana@x.com", "https://site.com/a");
    expect(verifyClick("c2", "ana@x.com", "https://site.com/a", sig)).toBe(false);
    expect(verifyClick("c1", "bob@x.com", "https://site.com/a", sig)).toBe(false);
    expect(verifyClick("c1", "ana@x.com", "https://site.com/a", null)).toBe(false);
    expect(verifyClick("c1", "ana@x.com", "https://site.com/a", "deadbeef")).toBe(false);
  });

  it("unsub: assina e verifica; rejeita adulteração", () => {
    const sig = signUnsub("c1", "ana@x.com");
    expect(verifyUnsub("c1", "ana@x.com", sig)).toBe(true);
    expect(verifyUnsub("c1", "bob@x.com", sig)).toBe(false);
  });

  it("domínios separados: sig de click não vale como unsub e vice-versa", () => {
    const clickSig = signClick("c1", "ana@x.com", "https://site.com/a");
    expect(verifyUnsub("c1", "ana@x.com", clickSig)).toBe(false);
    const unsubSig = signUnsub("c1", "ana@x.com");
    expect(verifyClick("c1", "ana@x.com", "https://site.com/a", unsubSig)).toBe(false);
  });
});
