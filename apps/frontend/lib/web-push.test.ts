import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";
import { enableWebPush, getWebPushStatus } from "./web-push";

vi.mock("./api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const publicKey = btoa(String.fromCharCode(4, ...new Array(64).fill(1)))
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

describe("Web Push setup", () => {
  const requestPermission = vi.fn();
  const subscribe = vi.fn();
  const getSubscription = vi.fn();
  const register = vi.fn();
  const getRegistration = vi.fn();
  const subscription = {
    endpoint: "https://push.example.test/subscription",
    options: { applicationServerKey: null },
    toJSON: () => ({
      endpoint: "https://push.example.test/subscription",
      keys: { p256dh: "key", auth: "auth" },
    }),
    unsubscribe: vi.fn(),
  };
  const registration = {
    pushManager: { getSubscription, subscribe },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    requestPermission.mockResolvedValue("granted");
    getSubscription.mockResolvedValue(null);
    subscribe.mockResolvedValue(subscription);
    register.mockResolvedValue(registration);
    getRegistration.mockResolvedValue(undefined);
    vi.mocked(api.get).mockResolvedValue({
      data: { enabled: true, public_key: publicKey },
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });

    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(window, "Notification", {
      value: { permission: "default", requestPermission },
      configurable: true,
    });
    Object.defineProperty(window, "PushManager", { value: class {}, configurable: true });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register, ready: Promise.resolve(registration), getRegistration },
      configurable: true,
    });
  });

  it("reports that notifications can be enabled before permission is requested", async () => {
    await expect(getWebPushStatus()).resolves.toBe("available");
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("requests permission from a user action and stores the resulting subscription", async () => {
    await enableWebPush();

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    expect(api.post).toHaveBeenCalledWith("/push-subscriptions/", subscription.toJSON());
  });
});
