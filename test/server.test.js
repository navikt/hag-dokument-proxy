import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import request from "supertest";
import { getToken, validateToken, requestOboToken } from "@navikt/oasis";
import * as decoratorModule from "@navikt/nav-dekoratoren-moduler/ssr/index.js";

vi.mock("@navikt/nav-dekoratoren-moduler/ssr/index.js", () => ({
  buildCspHeader: vi.fn(() => ""),
  injectDecoratorServerSide: vi.fn(() => Promise.resolve("<html></html>")),
}));

vi.mock("@navikt/pino-logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const { default: app } = await import("../src/server.js");

vi.mock("@navikt/oasis", () => ({
  getToken: vi.fn(() => "mock-token"),
  validateToken: vi.fn(() => Promise.resolve({ ok: true })),
  requestOboToken: vi.fn(() =>
    Promise.resolve({ ok: true, token: "obo-token" }),
  ),
}));

const SYKMELDING_PATH =
  "/dokument/sykmelding/550e8400-e29b-41d4-a716-446655440000.pdf";
const SOKNAD_PATH = "/dokument/sykepengesoeknad/550e8400-e29b-41d4-a716-446655440000.pdf";
const GRAVID_SOKNAD_PATH = "/dokument/gravid-soknad/550e8400-e29b-41d4-a716-446655440000.pdf";
const GRAVID_KRAV_PATH = "/dokument/gravid-krav/550e8400-e29b-41d4-a716-446655440000.pdf";
const KRONISK_SOKNAD_PATH = "/dokument/kronisk-soknad/550e8400-e29b-41d4-a716-446655440000.pdf";
const KRONISK_KRAV_PATH = "/dokument/kronisk-krav/550e8400-e29b-41d4-a716-446655440000.pdf";
const DOKUMENT_ID = "550e8400-e29b-41d4-a716-446655440000";

function mockFetch({ ok = true, status = 200, contentLength = null } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      const headers = new Headers();
      if (contentLength) headers.set("content-length", String(contentLength));
      const body = Readable.toWeb(Readable.from(Buffer.from("%PDF-test")));
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

function mockFritakagpFetch({ jsonOk = true, jsonStatus = 200, pdfOk = true, pdfStatus = 200, contentLength = null } = {}) {
  let callCount = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        // First call: fritakagp API returns JSON
        const headers = new Headers();
        headers.set("content-type", "application/json");
        return Promise.resolve({
          ok: jsonOk,
          status: jsonStatus,
          statusText: String(jsonStatus),
          headers,
          json: () => Promise.resolve({ navn: "Test Person" }),
        });
      }
      // Second call: pdfgen returns PDF
      const headers = new Headers();
      if (contentLength) headers.set("content-length", String(contentLength));
      const body = Readable.toWeb(Readable.from(Buffer.from("%PDF-test")));
      return Promise.resolve({
        ok: pdfOk,
        status: pdfStatus,
        statusText: String(pdfStatus),
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
      expect(response.headers["content-disposition"]).toBe(
        `inline; filename="sykmelding-${DOKUMENT_ID}.pdf"`,
      );
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
      expect(response.headers.location).toBe("/dokument/feilmelding");
    });

    it("skal redirecte til /feilmelding når token er ugyldig", async () => {
      vi.mocked(validateToken).mockResolvedValueOnce({ ok: false });
      const response = await request(app).get(SYKMELDING_PATH).expect(302);
      expect(response.headers.location).toBe("/dokument/feilmelding");
    });

    it("skal redirecte til /feilmelding når OBO-token feiler", async () => {
      vi.mocked(requestOboToken).mockResolvedValueOnce({ ok: false });
      const response = await request(app).get(SYKMELDING_PATH).expect(302);
      expect(response.headers.location).toBe("/dokument/feilmelding");
    });

    it("skal redirecte til /ugyldig når dokumentType er ugyldig", async () => {
      const response = await request(app)
        .get("/dokument/ukjent-type/550e8400-e29b-41d4-a716-446655440000.pdf")
        .expect(302);
      expect(response.headers.location).toBe("/dokument/ugyldig");
    });

    it("skal redirecte til /ugyldig når dokumentId ikke er en gyldig UUID", async () => {
      const response = await request(app)
        .get("/dokument/sykmelding/ikke-en-uuid.pdf")
        .expect(302);
      expect(response.headers.location).toBe("/dokument/ugyldig");
    });

    it("skal redirecte til /404 når upstream returnerer 404", async () => {
      mockFetch({ ok: false, status: 404 });
      const response = await request(app).get(SYKMELDING_PATH).expect(302);
      expect(response.headers.location).toBe("/dokument/404");
    });

    it("skal redirecte til /403 når upstream returnerer 403", async () => {
      mockFetch({ ok: false, status: 403 });
      const response = await request(app).get(SYKMELDING_PATH).expect(302);
      expect(response.headers.location).toBe("/dokument/403");
    });

    it("skal redirecte til /feilmelding ved annen upstream-feil", async () => {
      mockFetch({ ok: false, status: 500 });
      const response = await request(app).get(SYKMELDING_PATH).expect(302);
      expect(response.headers.location).toBe("/dokument/feilmelding");
    });
  });

  describe("Fritakagp PDF-endepunkt", () => {
    it.each([
      ["gravid-soknad", GRAVID_SOKNAD_PATH],
      ["gravid-krav", GRAVID_KRAV_PATH],
      ["kronisk-soknad", KRONISK_SOKNAD_PATH],
      ["kronisk-krav", KRONISK_KRAV_PATH],
    ])("skal returnere PDF for %s", async (type, path) => {
      mockFritakagpFetch();
      const response = await request(app).get(path).expect(200);
      expect(response.headers["content-type"]).toContain("application/pdf");
      expect(response.headers["content-disposition"]).toBe(
        `inline; filename="${type}-${DOKUMENT_ID}.pdf"`,
      );
    });

    it("skal gjøre to fetch-kall (JSON + pdfgen) for fritakagp", async () => {
      mockFritakagpFetch();
      await request(app).get(GRAVID_SOKNAD_PATH).expect(200);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("skal redirecte til /404 når fritakagp API returnerer 404", async () => {
      mockFritakagpFetch({ jsonOk: false, jsonStatus: 404 });
      const response = await request(app).get(GRAVID_SOKNAD_PATH).expect(302);
      expect(response.headers.location).toBe("/dokument/404");
    });

    it("skal redirecte til /403 når fritakagp API returnerer 403", async () => {
      mockFritakagpFetch({ jsonOk: false, jsonStatus: 403 });
      const response = await request(app).get(GRAVID_KRAV_PATH).expect(302);
      expect(response.headers.location).toBe("/dokument/403");
    });

    it("skal redirecte til /feilmelding når pdfgen feiler", async () => {
      mockFritakagpFetch({ pdfOk: false, pdfStatus: 500 });
      const response = await request(app).get(KRONISK_SOKNAD_PATH).expect(302);
      expect(response.headers.location).toBe("/dokument/feilmelding");
    });

    it("skal redirecte til /feilmelding når OBO-token for fritakagp feiler", async () => {
      vi.mocked(requestOboToken).mockResolvedValueOnce({ ok: false });
      const response = await request(app).get(KRONISK_KRAV_PATH).expect(302);
      expect(response.headers.location).toBe("/dokument/feilmelding");
    });

    it("skal videresende Content-Length fra pdfgen", async () => {
      const body = Buffer.from("%PDF-test");
      mockFritakagpFetch({ contentLength: body.length });
      const response = await request(app).get(GRAVID_SOKNAD_PATH).expect(200);
      expect(response.headers["content-length"]).toBe(String(body.length));
    });
  });

  describe("Feilsider", () => {
    it("skal returnere 404 for ukjente stier", async () => {
      const response = await request(app).get("/finnes-ikke");
      expect(response.status).toBe(404);
    });

    it("skal falle tilbake til statisk HTML ved SSR-feil", async () => {
      vi.mocked(decoratorModule.injectDecoratorServerSide).mockRejectedValueOnce(
        new Error("SSR feilet"),
      );
      const response = await request(app).get("/dokument/feilmelding");
      expect(response.status).toBe(200);
    });
  });
});
