/**
 * Pi Network SDK client wrapper for Ayadi.
 * The SDK script is loaded globally in `src/routes/__root.tsx`
 * and exposes a `Pi` object on `window`.
 */

export type PiScope = "username" | "payments" | "wallet_address";

export interface PiAuthResult {
  accessToken: string;
  user: {
    uid: string;
    username: string;
  };
}

export interface PiPayment {
  identifier: string;
  // Other payment fields are provided by the SDK at runtime.
  [key: string]: unknown;
}

interface PiSDK {
  init: (options: { version: string; sandbox?: boolean }) => void;
  authenticate: (
    scopes: PiScope[],
    onIncompletePaymentFound: (payment: PiPayment) => void,
  ) => Promise<PiAuthResult>;
}

declare global {
  interface Window {
    Pi?: PiSDK;
  }
}

let initialized = false;

/**
 * Initialize the Pi SDK. Safe to call multiple times — only runs once.
 * @param sandbox When true (default), runs in sandbox/testing mode.
 */
export function initPi(sandbox: boolean = true): boolean {
  if (typeof window === "undefined") return false;
  if (!window.Pi) {
    console.warn("[Pi SDK] Not available on window. Are you in Pi Browser?");
    return false;
  }
  if (initialized) return true;

  try {
    window.Pi.init({ version: "2.0", sandbox });
    initialized = true;
    return true;
  } catch (err) {
    console.error("[Pi SDK] init failed:", err);
    return false;
  }
}

/**
 * Detect whether the current environment is Pi Browser.
 */
export function detectPiBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const hasPiSDK = typeof window.Pi !== "undefined";
  const isPiUA = /PiBrowser/i.test(ua);
  return hasPiSDK || isPiUA;
}

/**
 * Default handler for incomplete payments — should be overridden by the app
 * to forward `payment` to the backend for completion.
 */
function defaultOnIncompletePayment(payment: PiPayment) {
  console.warn("[Pi SDK] Incomplete payment found:", payment);
}

/**
 * Authenticate the current Pi user with the requested scopes.
 */
export async function authenticateUser(
  scopes: PiScope[] = ["username"],
  onIncompletePaymentFound: (payment: PiPayment) => void = defaultOnIncompletePayment,
): Promise<PiAuthResult> {
  if (typeof window === "undefined" || !window.Pi) {
    throw new Error("Pi SDK is not loaded. Open the app inside Pi Browser.");
  }
  if (!initialized) {
    initPi(true);
  }
  return window.Pi.authenticate(scopes, onIncompletePaymentFound);
}