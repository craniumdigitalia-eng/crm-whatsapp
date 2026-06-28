// Testes do createEvent: garante que o evento pede uma sala do Google Meet
// (conferenceData) e que o meetLink e extraido da resposta. getGoogleConfig e o
// fetch global sao mockados — nada bate no Google de verdade.

jest.mock("./integrations", () => ({
  getGoogleConfig: jest.fn().mockResolvedValue({
    clientId: "cid",
    clientSecret: "secret",
    refreshToken: "refresh",
    redirectUri: "",
    calendarId: "primary",
  }),
}));

import { createEvent } from "./calendar";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

// Mocka as duas chamadas de fetch: 1) troca do refresh_token por access_token;
// 2) POST do evento. Retorna a captura da URL/body do POST do evento.
function mockFetch(eventResponse: Record<string, unknown>) {
  const calls: { url: string; body: unknown }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) } as Response;
    }
    calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return { ok: true, status: 200, json: async () => eventResponse } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

test("createEvent pede sala do Meet (conferenceData) e envia conferenceDataVersion=1", async () => {
  const calls = mockFetch({
    id: "evt-1",
    htmlLink: "https://cal/evt-1",
    hangoutLink: "https://meet.google.com/abc-defg-hij",
  });

  const result = await createEvent({
    summary: "Reuniao",
    start: "2026-07-03T18:00:00Z",
    end: "2026-07-03T18:30:00Z",
  });

  const eventCall = calls[0];
  // URL do POST inclui conferenceDataVersion=1.
  expect(eventCall.url).toContain("conferenceDataVersion=1");
  // Corpo pede a criacao da sala do Meet.
  const body = eventCall.body as {
    conferenceData?: { createRequest?: { requestId?: string; conferenceSolutionKey?: { type?: string } } };
  };
  expect(body.conferenceData?.createRequest?.conferenceSolutionKey?.type).toBe("hangoutsMeet");
  expect(body.conferenceData?.createRequest?.requestId).toBeTruthy();
  // meetLink extraido do hangoutLink.
  expect(result.meetLink).toBe("https://meet.google.com/abc-defg-hij");
});

test("createEvent extrai meetLink do entryPoint de video quando nao ha hangoutLink", async () => {
  mockFetch({
    id: "evt-2",
    conferenceData: {
      entryPoints: [
        { entryPointType: "more", uri: "https://meet.google.com/tel" },
        { entryPointType: "video", uri: "https://meet.google.com/xyz-uvwx-yz" },
      ],
    },
  });

  const result = await createEvent({
    summary: "Reuniao",
    start: "2026-07-03T18:00:00Z",
    end: "2026-07-03T18:30:00Z",
  });

  expect(result.meetLink).toBe("https://meet.google.com/xyz-uvwx-yz");
});
