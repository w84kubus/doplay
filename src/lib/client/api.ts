"use client";
import { ensureAnonAuth } from "@/lib/firebase/client";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wspólna droga do naszego API: token z Firebase Auth + jednolita obsługa błędów. */
async function apiCall<T>(method: "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const user = await ensureAnonAuth();
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      (data as { error?: string }).error ?? "Coś poszło nie tak.",
    );
  }
  return data as T;
}

/** POST do naszego API z dołączonym Firebase ID tokenem. Rzuca ApiClientError z polskim komunikatem. */
export function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  return apiCall<T>("POST", path, body);
}

/** DELETE do naszego API. Tą samą drogą co POST — różni się tylko metodą. */
export function apiDelete<T = unknown>(path: string, body?: unknown): Promise<T> {
  return apiCall<T>("DELETE", path, body);
}
