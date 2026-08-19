import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import "./mocks.js";
import { getToken } from "@navikt/oasis";
import { jwtVerify } from "jose";

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => "mock-jwks"),
  jwtVerify: vi.fn(),
}));

process.env.DIALOGPORTEN_JWKS_URI = "https://dialogporten.example.com/jwks";
process.env.DIALOGPORTEN_ISSUER = "https://dialogporten.example.com";
process.env.DIALOG_FCE_BASEPATH = "http://dialog";

const { default: app } = await import("../src/server.js");

const DIALOG_ID = "e0300961-85fb-4ef2-abff-681d77f9960e";
const TRANSMISSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const FCE_PATH = `/dokument/fce/sett-transmission-lest?dialogId=${DIALOG_ID}&transmissionId=${TRANSMISSION_ID}`;
const AUTH_HEADER = "Bearer mock-dialog-token";

function mockDialogTokenPayload(overrides = {}) {
  vi.mocked(jwtVerify).mockResolvedValue({
    payload: { i: DIALOG_ID, ...overrides },
  });
}

function mockFetch({ ok = true, status = 200 } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok, status, statusText: String(status) })),
  );
}

async function flushBackgroundCall() {
  // Vent til bakgrunnskallet (fire-and-forget) rekker å kjøre.
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

describe("FCE-endepunkt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(getToken).mockReturnValue("mock-dialog-token");
    mockDialogTokenPayload();
    mockFetch();
  });

  it("skal umiddelbart returnere tom streng med status 200", async () => {
    const response = await request(app)
      .get(FCE_PATH)
      .set("Authorization", AUTH_HEADER)
      .expect(200);
    expect(response.text).toBe("");
  });

  it("skal returnere tom streng selv uten dialogId eller transmissionId", async () => {
    const response = await request(app)
      .get("/dokument/fce/sett-transmission-lest")
      .set("Authorization", AUTH_HEADER)
      .expect(200);
    expect(response.text).toBe("");
  });

  it("skal returnere tom streng selv med ugyldige ID-er eller manglende token", async () => {
    const response = await request(app)
      .get("/dokument/fce/sett-transmission-lest?dialogId=ikke-en-uuid")
      .expect(200);
    expect(response.text).toBe("");
  });

  it("skal sette CORS-headere som tillater Authorization og Prefer", async () => {
    const response = await request(app)
      .get(FCE_PATH)
      .set("Authorization", AUTH_HEADER)
      .expect(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["access-control-allow-headers"]).toContain(
      "Authorization",
    );
    expect(response.headers["access-control-allow-methods"]).toContain(
      "OPTIONS",
    );
  });

  it("skal svare 204 med CORS-headere på preflight (OPTIONS)", async () => {
    const response = await request(app).options(FCE_PATH).expect(204);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["access-control-allow-headers"]).toContain(
      "Authorization",
    );
    expect(response.headers["access-control-allow-methods"]).toContain(
      "OPTIONS",
    );
  });

  it("skal parse Authorization-headeren, verifisere dialogtoken, og kalle dialog-appen i bakgrunnen med dialogId og transmissionId", async () => {
    await request(app)
      .get(FCE_PATH)
      .set("Authorization", AUTH_HEADER)
      .expect(200);
    await flushBackgroundCall();

    expect(getToken).toHaveBeenCalledWith(AUTH_HEADER);

    expect(jwtVerify).toHaveBeenCalledWith(
      "mock-dialog-token",
      "mock-jwks",
      expect.objectContaining({
        algorithms: ["EdDSA"],
        issuer: "https://dialogporten.example.com",
      }),
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0];
    const url = new URL(calledUrl);
    expect(url.hostname).toBe("dialog");
    expect(url.pathname).toBe("/transmission-lest");
    expect(url.searchParams.get("dialogId")).toBe(DIALOG_ID);
    expect(url.searchParams.get("transmissionId")).toBe(TRANSMISSION_ID);
    expect(init.method).toBe("PUT");
  });

  it("skal ikke kalle dialog-appen når dialogtoken mangler", async () => {
    vi.mocked(getToken).mockReturnValueOnce(null);
    await request(app).get(FCE_PATH).expect(200);
    await flushBackgroundCall();

    expect(jwtVerify).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skal ikke kalle dialog-appen når dialogtoken er ugyldig", async () => {
    vi.mocked(jwtVerify).mockRejectedValueOnce(new Error("ugyldig signatur"));
    await request(app)
      .get(FCE_PATH)
      .set("Authorization", AUTH_HEADER)
      .expect(200);
    await flushBackgroundCall();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("skal ikke kalle dialog-appen når dialogId i URL ikke samsvarer med dialogtoken", async () => {
    mockDialogTokenPayload({ i: "annen-dialog-id" });
    await request(app)
      .get(FCE_PATH)
      .set("Authorization", AUTH_HEADER)
      .expect(200);
    await flushBackgroundCall();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("skal ikke feile responsen selv om kallet til dialog-appen feiler", async () => {
    mockFetch({ ok: false, status: 500 });
    const response = await request(app)
      .get(FCE_PATH)
      .set("Authorization", AUTH_HEADER)
      .expect(200);
    expect(response.text).toBe("");
    await flushBackgroundCall();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
