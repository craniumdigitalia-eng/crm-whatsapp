import { parseMakeLead, parseFieldData } from "./meta";

// Cobre o parser do payload do Make (caminho principal de ingresso de leads).
describe("parseMakeLead", () => {
  it("extrai nome/telefone/atribuicao de um objeto plano", () => {
    const out = parseMakeLead({
      name: "Maria Souza",
      phone: "+55 (11) 99876-5432",
      "Qual servico?": "Trafego pago",
      leadgen_id: "LG123",
      form_id: "F1",
      ad_id: "A1",
      campaign_id: "C1",
    });
    expect(out.name).toBe("Maria Souza");
    expect(out.phone).toBe("+5511998765432");
    expect(out.leadgenId).toBe("LG123");
    expect(out.formId).toBe("F1");
    expect(out.adId).toBe("A1");
    expect(out.campaignId).toBe("C1");
    // form_data preserva as respostas, sem os metadados de atribuicao.
    expect(out.formData["Qual servico?"]).toBe("Trafego pago");
    expect(out.formData.leadgen_id).toBeUndefined();
    expect(out.formData.form_id).toBeUndefined();
  });

  it("monta nome a partir de first/last quando nao ha nome completo", () => {
    const out = parseMakeLead({ first_name: "Joao", last_name: "Silva", phone: "5511999998888" });
    expect(out.name).toBe("Joao Silva");
    expect(out.phone).toBe("5511999998888");
  });

  it("suporta o lead cru do Meta com field_data (array)", () => {
    const out = parseMakeLead({
      id: "LG999",
      form_id: "F9",
      field_data: [
        { name: "full_name", values: ["Ana Lima"] },
        { name: "phone_number", values: ["+5521988887777"] },
        { name: "orcamento", values: ["5 mil"] },
      ],
    });
    expect(out.name).toBe("Ana Lima");
    expect(out.phone).toBe("+5521988887777");
    expect(out.leadgenId).toBe("LG999");
    expect(out.formId).toBe("F9");
    expect(out.formData.orcamento).toBe("5 mil");
  });

  it("nao quebra com payload vazio", () => {
    const out = parseMakeLead({});
    expect(out.name).toBeUndefined();
    expect(out.phone).toBeUndefined();
    expect(out.formData).toEqual({});
  });
});

// Sanidade do parser reaproveitado.
describe("parseFieldData", () => {
  it("extrai telefone e nome das chaves padrao do Meta", () => {
    const out = parseFieldData([
      { name: "full_name", values: ["Carlos"] },
      { name: "phone_number", values: ["11 91234-5678"] },
    ]);
    expect(out.name).toBe("Carlos");
    expect(out.phone).toBe("1191234-5678".replace(/[^\d+]/g, ""));
  });
});
