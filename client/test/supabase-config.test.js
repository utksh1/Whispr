import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn(() => ({ auth: {} }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

describe("Supabase env normalization", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ENABLE_DEMO_ADMIN;
    process.env.NODE_ENV = "test";
  });

  it("normalizes malformed public Supabase env strings", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "N\\nhttps://lptfbgohubujthjnerwm.supabase.co\\n";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "N\\nsb_publishable_test\\n";
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF = "lptfbgohubujthjnerwm\\n";

    const { SUPABASE_CONFIG } = await import("../src/lib/supabase");

    expect(SUPABASE_CONFIG).toMatchObject({
      url: "https://lptfbgohubujthjnerwm.supabase.co",
      publishableKey: "sb_publishable_test",
      projectRef: "lptfbgohubujthjnerwm",
    });
    expect(createClientMock).toHaveBeenCalledWith(
      "https://lptfbgohubujthjnerwm.supabase.co",
      "sb_publishable_test",
      expect.any(Object)
    );
  });

  it("normalizes malformed admin env strings", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "N\\nhttps://lptfbgohubujthjnerwm.supabase.co\\n";
    process.env.SUPABASE_SECRET_KEY = "service-role-secret\\n";
    process.env.ENABLE_DEMO_ADMIN = "true\\n";

    const { getSupabaseAdminClient, isDemoAdminEnabled } = await import(
      "../src/lib/supabase-admin"
    );

    expect(isDemoAdminEnabled()).toBe(true);
    getSupabaseAdminClient();
    expect(createClientMock).toHaveBeenCalledWith(
      "https://lptfbgohubujthjnerwm.supabase.co",
      "service-role-secret",
      expect.any(Object)
    );
  });
});
