export const API_VERSION = "v1" as const;

export type ApiError = {
  code: string;
  detail: string;
  requestId?: string;
};
