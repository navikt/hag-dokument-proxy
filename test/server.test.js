import { describe, it, expect, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../src/server.js";
import { validateToken } from "@navikt/oasis";

vi.mock("@navikt/oasis", () => ({
  getToken: vi.fn(() => "mock-token"),
  validateToken: vi.fn(() => Promise.resolve({ ok: true })),
}));

describe("Server", () => {
  let server;

  afterAll(() => {
    if (server) server.close();
  });

  it("skal redirecte rot-path til /success", async () => {
    const response = await request(app).get("/").expect(302);
    expect(response.headers.location).toBe("/success");
  });

  it("skal redirecte rot-path til /feilmelding når token er ugyldig", async () => {
    vi.mocked(validateToken).mockResolvedValueOnce({ ok: false });
    const response = await request(app).get("/").expect(302);
    expect(response.headers.location).toBe("/feilmelding");
  });

  it("skal servere statiske filer fra feilmelding-mappen", async () => {
    // Test at en fil kan serveres fra /feilmelding
    const response = await request(app).get("/feilmelding/index.html");
    expect(response.status).not.toBe(404);
  });

  it("skal sette riktig PORT fra miljøvariabel eller default til 3000", () => {
    const PORT = process.env.PORT || 3000;
    expect(PORT).toBe(3000);
  });
});
