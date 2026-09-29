export interface RequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  revalidate?: number | false;
}

export class MovieApiError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = "INTERNAL_ERROR") {
    super(message);
    this.name = "MovieApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MovieApiClient {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();

  private getBaseUrl(): string {
    return process.env.MOVIE_API_BASE_URL || "https://phimapi.com";
  }

  private getDefaultTimeout(): number {
    const envTimeout = process.env.MOVIE_API_TIMEOUT_MS;
    return envTimeout ? parseInt(envTimeout, 10) : 8000;
  }

  private getDefaultRetries(): number {
    const envRetries = process.env.MOVIE_API_RETRY_COUNT;
    return envRetries ? parseInt(envRetries, 10) : 2;
  }

  private isRetryableStatusCode(status: number): boolean {
    return status === 502 || status === 503 || status === 504 || status === 408;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private validateSafeUrl(baseUrl: string, path: string): string {
    // 1. Block protocol-relative or absolute URL injection in relative path parameter
    if (path.startsWith("//") || /^https?:\/\//i.test(path)) {
      throw new MovieApiError("Blocked SSRF attempt: absolute paths not allowed", 400, "SSRF_BLOCKED");
    }

    // 2. Block path traversal attempts
    if (path.includes("/../") || path.endsWith("/..") || path.startsWith("../") || path.includes("\\")) {
      throw new MovieApiError("Blocked path traversal attempt", 400, "TRAVERSAL_BLOCKED");
    }

    const cleanBase = baseUrl.replace(/\/+$/, "");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    // 3. Verify protocol is safe
    try {
      const parsed = new URL(`${cleanBase}${cleanPath}`);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new MovieApiError("Disallowed protocol in API request", 400, "INVALID_PROTOCOL");
      }
      return parsed.toString();
    } catch {
      throw new MovieApiError("Malformed API URL", 400, "INVALID_URL");
    }
  }

  public async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const cacheKey = path;
    const ttlSeconds = typeof options.revalidate === "number" ? options.revalidate : 300;

    // 1. Check in-memory cache
    const cached = this.memoryCache.get(cacheKey);
    if (cached) {
      // If fresh, return immediately in 0ms
      if (Date.now() < cached.expiresAt) {
        return cached.data as T;
      }
      // Stale-While-Revalidate: Return stale cached data immediately (0ms) and revalidate in background
      this.fetchDirectly<T>(path, cacheKey, ttlSeconds, options).catch(() => {});
      return cached.data as T;
    }

    // 2. In-flight request deduplication: merge concurrent calls to same path
    const inFlightPromise = this.inFlight.get(cacheKey);
    if (inFlightPromise) {
      return inFlightPromise as Promise<T>;
    }

    const fetchPromise = this.fetchDirectly<T>(path, cacheKey, ttlSeconds, options);
    this.inFlight.set(cacheKey, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async fetchDirectly<T>(
    path: string,
    cacheKey: string,
    ttlSeconds: number,
    options: RequestOptions
  ): Promise<T> {
    const url = this.validateSafeUrl(this.getBaseUrl(), path);

    const maxRetries = options.retries !== undefined ? options.retries : this.getDefaultRetries();
    const timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : this.getDefaultTimeout();

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const fetchOptions: RequestInit & { next?: { revalidate?: number | false } } = {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": "RubyFilm-BFF/1.0",
            ...options.headers,
          },
          signal: controller.signal,
        };

        if (options.revalidate !== undefined) {
          fetchOptions.next = { revalidate: options.revalidate };
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(timer);

        // Check if response is ok
        if (!response.ok) {
          const status = response.status;
          let errorMessage = `Provider HTTP Error ${status}`;

          try {
            const errorBody = await response.text();
            if (errorBody) {
              errorMessage += `: ${errorBody.slice(0, 100)}`;
            }
          } catch {
            // ignore body read error
          }

          // Non-retryable client errors: 400, 401, 403, 404
          if (!this.isRetryableStatusCode(status) || attempt === maxRetries) {
            let errorCode = "PROVIDER_ERROR";
            if (status === 404) errorCode = "NOT_FOUND";
            else if (status === 400) errorCode = "BAD_REQUEST";
            else if (status === 401 || status === 403) errorCode = "UNAUTHORIZED";
            else if (status === 429) errorCode = "RATE_LIMITED";

            throw new MovieApiError(errorMessage, status, errorCode);
          }

          // Retryable status code (502, 503, 504)
          lastError = new MovieApiError(errorMessage, status, "PROVIDER_UNAVAILABLE");
          attempt++;
          await this.sleep(400 * Math.pow(2, attempt - 1));
          continue;
        }

        // Parse JSON
        try {
          const data = (await response.json()) as T;

          // Save to memory cache (limit to 1000 items to prevent RAM bloat)
          if (this.memoryCache.size > 1000) {
            const oldestKey = this.memoryCache.keys().next().value;
            if (oldestKey) this.memoryCache.delete(oldestKey);
          }
          this.memoryCache.set(cacheKey, {
            data,
            expiresAt: Date.now() + ttlSeconds * 1000,
          });

          return data;
        } catch (jsonErr) {
          throw new MovieApiError(
            `Failed to parse JSON response from provider: ${(jsonErr as Error).message}`,
            502,
            "MALFORMED_RESPONSE"
          );
        }
      } catch (err: unknown) {
        clearTimeout(timer);
        const error = err as Error;

        // Abort error (Timeout)
        if (error.name === "AbortError") {
          lastError = new MovieApiError(`External request timed out after ${timeoutMs}ms`, 504, "GATEWAY_TIMEOUT");
        } else if (error instanceof MovieApiError) {
          // If already MovieApiError and non-retryable, rethrow immediately
          if (!this.isRetryableStatusCode(error.statusCode)) {
            throw error;
          }
          lastError = error;
        } else {
          // Network error (fetch failed)
          lastError = new MovieApiError(`Network failure: ${error.message}`, 502, "NETWORK_ERROR");
        }

        if (attempt >= maxRetries) {
          throw lastError;
        }

        attempt++;
        await this.sleep(400 * Math.pow(2, attempt - 1));
      }
    }

    throw lastError || new MovieApiError("Unknown provider error", 500, "INTERNAL_ERROR");
  }
}

export const movieApiClient = new MovieApiClient();
