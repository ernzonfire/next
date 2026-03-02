import { supabase } from "@/lib/supabase/client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

const getAccessToken = async () => {
  try {
    const sessionResponse = await withTimeout(supabase.auth.getSession(), 5000, "Session check");
    const session = sessionResponse.data.session;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session?.expires_at ?? 0;
    const shouldRefresh = !session?.access_token || (expiresAt > 0 && expiresAt - now < 60);

    if (session?.access_token && !shouldRefresh) {
      return sessionResponse.data.session.access_token;
    }
  } catch (_err) {
    // ignore and try refresh
  }

  try {
    const refreshed = await withTimeout(
      supabase.auth.refreshSession(),
      5000,
      "Session refresh"
    );
    if (refreshed.data.session?.access_token) {
      return refreshed.data.session.access_token;
    }
  } catch (_err) {
    // ignore and fall back
  }

  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session?.access_token ?? null;
};

export const invokeEdge = async <T>(
  name: string,
  body: Record<string, unknown>,
  { timeoutMs = 15000 }: { timeoutMs?: number } = {}
): Promise<T> => {
  const runRequest = async (accessToken: string) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Request timed out. Please try again.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const firstToken = await getAccessToken();
  if (!firstToken) {
    throw new Error("Your session expired. Please log in again.");
  }

  let response = await runRequest(firstToken);

  // If token is stale (e.g., keys rotated), refresh once and retry before forcing logout.
  if (response.status === 401) {
    const refreshed = await withTimeout(supabase.auth.refreshSession(), 5000, "Session refresh");
    const retryToken = refreshed.data.session?.access_token ?? null;
    if (retryToken) {
      response = await runRequest(retryToken);
    }
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_err) {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut();
    }
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error?: string }).error ?? "")
        : "Edge Function returned an error.";
    throw new Error(message || "Edge Function returned an error.");
  }

  return payload as T;
};

export const invokeEdgePublic = async <T>(
  name: string,
  body: Record<string, unknown>,
  { timeoutMs = 15000 }: { timeoutMs?: number } = {}
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_err) {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error?: string }).error ?? "")
        : "Edge Function returned an error.";
    throw new Error(message || "Edge Function returned an error.");
  }

  return payload as T;
};
