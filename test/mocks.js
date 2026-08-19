import { vi } from "vitest";

// Felles mocks som gjenbrukes av flere testfiler (må importeres før oasis)

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

vi.mock("@navikt/oasis", () => ({
  getToken: vi.fn(() => "mock-token"),
  validateToken: vi.fn(() => Promise.resolve({ ok: true })),
  requestOboToken: vi.fn(() =>
    Promise.resolve({ ok: true, token: "obo-token" }),
  ),
}));
