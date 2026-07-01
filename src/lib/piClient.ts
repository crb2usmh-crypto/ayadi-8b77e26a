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

export type PiAdType = "interstitial" | "rewarded";

export interface PiPaymentData {
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
}

export interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: PiPayment) => void;
}

interface PiSDK {
  init: (options: { version: string; sandbox?: boolean }) => void;
  authenticate: (
    scopes: PiScope[],
    onIncompletePaymentFound: (payment: PiPayment) => void,
  ) => Promise<PiAuthResult>;
  createPayment?: (data: PiPaymentData, callbacks: PiPaymentCallbacks) => void;
  Ads?: {
    showAd: (type: PiAdType) => Promise<{ result: string; adId?: string }>;
    isAdReady?: (type: PiAdType) => Promise<{ ready: boolean }>;
    requestAd?: (type: PiAdType) => Promise<{ result: string }>;
  };
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
    const isSandbox = import.meta.env.VITE_PI_SANDBOX === "true" || import.meta.env.DEV;
    initPi(isSandbox);
  }
  return window.Pi.authenticate(scopes, onIncompletePaymentFound);
}

/**
 * Show a Pi Ad if the SDK & Ads module are available.
 * Silently no-ops outside Pi Browser or if the ad fails.
 */
export async function showPiAd(type: PiAdType = "interstitial"): Promise<boolean> {
  if (typeof window === "undefined" || !window.Pi?.Ads?.showAd) return false;
  try {
    if (window.Pi.Ads.isAdReady) {
      const r = await window.Pi.Ads.isAdReady(type).catch(() => ({ ready: true }));
      if (!r.ready && window.Pi.Ads.requestAd) {
        await window.Pi.Ads.requestAd(type).catch(() => undefined);
      }
    }
    const res = await window.Pi.Ads.showAd(type);
    return res.result === "AD_DISPLAYED" || res.result === "AD_CLOSED" || res.result === "AD_REWARDED";
  } catch (err) {
    console.warn("[Pi Ads] showAd failed:", err);
    return false;
  }
}

/**
 * Create a Pi payment. Returns a promise that resolves when the payment is
 * completed server-side (or rejects on cancel/error).
 */
export function createPiPayment(
  data: PiPaymentData,
  handlers: {
    onApprove: (paymentId: string) => Promise<void>;
    onComplete: (paymentId: string, txid: string) => Promise<void>;
  },
): Promise<{ paymentId: string; txid: string }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.Pi?.createPayment) {
      reject(new Error("Pi payments require Pi Browser"));
      return;
    }
    let approvedId = "";
    window.Pi.createPayment(data, {
      onReadyForServerApproval: (paymentId) => {
        approvedId = paymentId;
        handlers.onApprove(paymentId).catch((e) => reject(e));
      },
      onReadyForServerCompletion: (paymentId, txid) => {
        handlers
          .onComplete(paymentId, txid)
          .then(() => resolve({ paymentId, txid }))
          .catch((e) => reject(e));
      },
      onCancel: () => reject(new Error("payment_cancelled")),
      onError: (err) => reject(err),
    });
  });
}