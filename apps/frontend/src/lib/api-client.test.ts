import { beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  // eslint-disable-next-line no-var
  var fetch: typeof fetch;
}

describe("api-client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("appends query parameters for GET requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiGet } = await import("./api-client");

    await apiGet("/v1/example", { query: { search: "hello world", limit: 5 } });

    expect(fetchMock).toHaveBeenCalledWith(`${window.location.origin}/v1/example?search=hello+world&limit=5`, expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({
        Accept: "application/json",
      }),
    }));
  });

  it("stringifies body and attaches CSRF token for POST requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrf_token: "csrf-token", expires_at: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ created: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiPost } = await import("./api-client");

    await apiPost("/v1/example", { name: "test" });

    expect(fetchMock).toHaveBeenNthCalledWith(2, `${window.location.origin}/v1/example`, {
      body: JSON.stringify({ name: "test" }),
      credentials: "include",
      headers: expect.objectContaining({
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": "csrf-token",
      }),
      method: "POST",
    });
  });

  it("throws ApiError for network failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Network down"));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiGet, ErrorType } = await import("./api-client");

    await expect(apiGet("/v1/example")).rejects.toMatchObject({
      status: 0,
      type: ErrorType.NETWORK,
    });
  });

  it("normalizes API errors with server detail messages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrf_token: "csrf-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Invalid input" }), {
          status: 422,
          statusText: "Unprocessable Entity",
          headers: { "Content-Type": "application/json" },
        })
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiPost, ApiError } = await import("./api-client");

    let caughtError: unknown;
    try {
      await apiPost("/v1/example", { name: "" });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      status: 422,
      message: "Invalid input: Invalid input",
    });
  });
});
