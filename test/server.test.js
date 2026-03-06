import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import request from "supertest";
import app from "../src/server.js";
import { getToken, validateToken, requestOboToken } from "@navikt/oasis";

vi.mock("@navikt/oasis", () => ({
  getToken: vi.fn(() => "mock-token"),
  validateToken: vi.fn(() => Promise.resolve({ ok: true })),
  requestOboToken: vi.fn(() => Promise.resolve({ ok: true, token: "obo-token" })),
}));

const SYKMELDING_PATH = "/hent-dokument/sykmelding/550e8400-e29b-41d4-a716-446655440000.pdf";
const SOKNAD_PATH = "/hent-dokument/soknad/550e8400-e29b-41d4-a716-446655440000.pdf";
const DOKUMENT_ID = "550e8400-e29b-41d4-a716-446655440000";

function mockFetch({ ok = true, status = 200, contentLength = null } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      const headers = new Headers();
      if (contentLength) headers.set("content-length", String(contentLength));
      const body = Readable.from(Buffer.from("%PDF-test"));
      return Promise.resolve({
        ok,
        status,
        statusText: String(status),
        headers,
        body,
      });
    }),
  );
}

describe("Server", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(getToken).mockReturnValue("mock-token");
    vi.mocked(validateToken).mockResolvedValue({ ok: true });
    vi.mocked(requestOboToken).mockResolvedValue({
      ok: true,
      token: "obo-token",
    });
  });

  describe("X-Powered-By", () => {
    it("skal ikke sende X-Powered-By-header", async () => {
      mockFetch();
      const response = await request(app).get(SYKMELDING_PATH);
      expect(response.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("PDF-endepunkt", () => {
    it("skal returnere PDF ved gyldig sykmelding-forespørsel", async () => {
      mockFetch();
      const response = await request(app).get(SYKMELDING_PATH).expect(200);
      expect(response.headers["content-type"]).toContain("application/pdf");
    });

    it("skal returnere PDF ved gyldig soknad-forespørsel", async () => {
      mockFetch();
      const response = await request(app).get(SOKNAD_PATH).expect(200);
      expect(response.headers["content-type"]).toContain("application/pdf");
    });

    it("skal sette Content-Disposition med riktig filnavn", async () => {
      mockFetch();
      const response = await request(app).get(SYKMELDING_PATH).expect(200);
      expect(response.headers["content-disposition"]).toBe(`inline; filename="sykmelding-${DOKUMENT_ID}.pdf"`);
    });

    it("skal videresende Content-Length når upstream sender den", async () => {
      const body = Buffer.from("%PDF-test");
      mockFetch({ contentLength: body.length });
      const response = await request(app).get(SYKMELDING_PATH).expect(200);
      expect(response.headers["content-length"]).toBe(String(body.length));
    });

    it("skal redirecte til /feilmelding når token mangler", async () => {
      vi.mocked(getToken).mockReturnValueOnce(null);
      const response = await request(app).get(SYKMELDING_PATH).expect(302);
      expect(response.headers.location).toBe("/feilmelding");
    });

    it("skal redirecte til /feilmelding når token er ugyldig", async () => {
      vi.mocked(validateToken).mockResolvedValueOnce({ ok: false });
      const response = await request(app).get(SYKMELDING_PATH).expect(302);
      expect(response.headers.location).toBe("/feilmelding");
    });

    it("skal redirecte til /feilmelding når OBO-token feiler", async () => {
      vi.mocked(requestOboToken).mockResolvedValueOnce({ ok: false });
      const response = await request(app).get(SYKMELDING_PATH).expect(302);
      expect(response.headers.location).toBe("/feilmelding");
    });

    it("skal redirecte til /ugyldig når dokumentType er ugyldig", async () => {
      const response = await request(app)
        .get("/hent-dokument/ugyldig/550e8400-e29b-41d4-a716-446655440000.pdf")
        .expect(302);
      expect(response.headers.location).toBe("/ugyldig");
    });

    it("skal redirecte til /ugyldig når dokumentId ikke er en gyldig UUID", async () => {
      const response = await request(app).get("/hent-dokument/sykmelding/ikke-en-uuid.pdf").expect(302);
      expect(response.headers.location).toBe("/ugyldig");
    });

    it("skal redirecte til /404 når upstream returnerer 404", async () => {
      mockFetch({ ok: false, status: 404 });
      const response = await request(app).get(SYKMELDING_PATH).expect(302);
      expect(response.headers.location).toBe("/404");
    });

    it("skal redirecte til /403 når upstream returnerer 403", async () => {
      mockFetch({ ok: false, status: 403 });
      const response = await request(app).get(SYKMELDING_PATH).expect(302);
      expect(response.headers.location).toBe("/403");
    });

    it("skal redirecte til /feilmelding ved annen upstream-feil", async () => {
      mockFetch({ ok: false, status: 500 });
      const response = await request(app).get(SYKMELDING_PATH).expect(302);
      expect(response.headers.location).toBe("/feilmelding");
    });
  });

  describe("Feilsider", () => {
    it("skal returnere 404 for ukjente stier", async () => {
      const response = await request(app).get("/finnes-ikke");
      expect(response.status).toBe(404);
    });
  });
});
