export type TelegramIdentity = {
  id: number;
  isBot: boolean;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
};

export type CoreUser = {
  id: string;
  displayName: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CoreSocialAccount = {
  id: string;
  userId: string;
  platform: "TELEGRAM" | "FARCASTER";
  platformUserId: string;
  username: string | null;
  profileUrl: string | null;
};

export type TraderProfile = {
  id: string;
  userId: string;
  handle: string;
  bio: string | null;
};

export type TelegramUserSession = {
  user: CoreUser;
  socialAccount: CoreSocialAccount | null;
  traderProfile: TraderProfile | null;
};

export type Market = {
  id: string;
  externalMarketId: string;
  source: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  resolutionDate: string | null;
  externalUrl: string | null;
  yesTokenId: string | null;
  noTokenId: string | null;
  lastTradePrice?: string | null;
  bestBid?: string | null;
  bestAsk?: string | null;
  syncedAt?: string | null;
};

export type LeaderboardEntry = {
  traderProfileId?: string;
  userId?: string;
  handle?: string;
  displayName?: string | null;
  score?: number | string | null;
  rank?: number | null;
};

export type TradeSignal = {
  id: string;
  traderProfileId: string;
  marketId: string;
  side: "YES" | "NO";
  thesis: string;
  convictionLevel: number | null;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type Position = {
  id: string;
  userId: string;
  marketId: string;
  side: "YES" | "NO";
  quantity: string;
  averageEntryPrice: string | null;
  observedMarketPrice?: string | null;
  observedMarketPriceSource?: string | null;
  observedMarketPriceAt?: string | null;
  status: string;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CopyTrade = {
  id: string;
  followerId: string;
  sourcePositionId: string;
  sourceSignalId: string | null;
  requestedQuantity: string;
  executedQuantity: string | null;
  executionPrice: string | null;
  observedMarketPrice?: string | null;
  resultingPositionId: string | null;
  status: string;
  externalOrderId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiSuccess<TData> = {
  ok: true;
  data: TData;
};

type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ApiEnvelope<TData> = ApiSuccess<TData> | ApiFailure;

export class CoreApiError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(message: string, options: { code: string; statusCode: number; details?: unknown }) {
    super(message);
    this.name = "CoreApiError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
  }
}

export class CoreApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async createOrFetchTelegramUser(identity: TelegramIdentity) {
    const displayName = [identity.firstName, identity.lastName].filter(Boolean).join(" ") || null;
    const session = await this.request<TelegramUserSession>("/social-accounts", {
      method: "POST",
      body: JSON.stringify({
        platform: "TELEGRAM",
        platformUserId: String(identity.id),
        username: identity.username ?? null,
        displayName,
        profileUrl: identity.username ? "https://t.me/" + identity.username : null,
        metadata: {
          isBot: identity.isBot,
          languageCode: identity.languageCode ?? null,
        },
      }),
    });

    return normalizeTelegramUserSession(session);
  }

  async listMarkets() {
    const response = await this.request<{ markets?: Market[] } | Market[]>("/markets");

    return Array.isArray(response) ? response : (response.markets ?? []);
  }

  async getMarket(id: string) {
    const response = await this.request<{ market?: Market } | Market>(
      "/markets/" + encodeURIComponent(id),
    );

    return "market" in response && response.market ? response.market : (response as Market);
  }

  async createTradeSignal(input: {
    traderProfileId: string;
    marketId: string;
    side: "YES" | "NO";
    thesis: string;
  }) {
    const response = await this.request<{ signal?: TradeSignal } | TradeSignal>("/signals", {
      method: "POST",
      body: JSON.stringify({
        traderProfileId: input.traderProfileId,
        marketId: input.marketId,
        side: input.side,
        thesis: input.thesis,
        source: "TELEGRAM",
      }),
    });

    return "signal" in response && response.signal ? response.signal : (response as TradeSignal);
  }

  async listMarketSignals(marketId: string) {
    const response = await this.request<{ signals?: TradeSignal[] } | TradeSignal[]>(
      "/markets/" + encodeURIComponent(marketId) + "/signals",
    );

    return Array.isArray(response) ? response : (response.signals ?? []);
  }

  async listUserPositions(userId: string) {
    const response = await this.request<{ positions?: Position[] } | Position[]>(
      "/users/" + encodeURIComponent(userId) + "/positions",
    );

    return Array.isArray(response) ? response : (response.positions ?? []);
  }

  async createCopyIntent(input: {
    followerId: string;
    sourcePositionId: string;
    requestedQuantity: string;
  }) {
    const response = await this.request<{ copyTrade?: CopyTrade } | CopyTrade>("/copy-trades", {
      method: "POST",
      body: JSON.stringify({
        followerId: input.followerId,
        sourcePositionId: input.sourcePositionId,
        requestedQuantity: input.requestedQuantity,
      }),
    });

    return "copyTrade" in response && response.copyTrade
      ? response.copyTrade
      : (response as CopyTrade);
  }

  async listLeaderboard() {
    try {
      const response = await this.request<
        | {
            leaderboard?: LeaderboardEntry[];
            entries?: LeaderboardEntry[];
            traders?: LeaderboardEntry[];
          }
        | LeaderboardEntry[]
      >("/leaderboard");

      if (Array.isArray(response)) {
        return response;
      }

      return response.leaderboard ?? response.entries ?? response.traders ?? [];
    } catch (error) {
      if (error instanceof CoreApiError && error.statusCode === 404) {
        return null;
      }

      throw error;
    }
  }

  private async request<TData>(path: string, init: RequestInit = {}) {
    let response: Response;

    try {
      response = await fetch(this.baseUrl + path, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
    } catch {
      throw new CoreApiError("Core API is not reachable", {
        code: "CORE_API_UNREACHABLE",
        statusCode: 503,
      });
    }

    const body = await parseJson(response);

    if (!response.ok) {
      const apiError = isApiFailure(body) ? body.error : null;
      throw new CoreApiError(apiError?.message ?? "Core API returned " + response.status, {
        code: apiError?.code ?? "CORE_API_ERROR",
        statusCode: response.status,
        details: apiError?.details,
      });
    }

    if (isApiFailure(body)) {
      throw new CoreApiError(body.error.message, {
        code: body.error.code,
        statusCode: response.status,
        details: body.error.details,
      });
    }

    if (isApiSuccess<TData>(body)) {
      return body.data;
    }

    return body as TData;
  }
}

async function parseJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CoreApiError("Core API returned invalid JSON", {
      code: "CORE_API_INVALID_JSON",
      statusCode: response.status,
    });
  }
}

function isApiSuccess<TData>(body: unknown): body is ApiEnvelope<TData> & ApiSuccess<TData> {
  return isRecord(body) && body.ok === true && "data" in body;
}

function isApiFailure(body: unknown): body is ApiFailure {
  return (
    isRecord(body) &&
    body.ok === false &&
    isRecord(body.error) &&
    typeof body.error.code === "string" &&
    typeof body.error.message === "string"
  );
}

function normalizeTelegramUserSession(data: TelegramUserSession) {
  if (!data.user?.id) {
    throw new CoreApiError("Core API did not return a user", {
      code: "CORE_API_INVALID_USER_RESPONSE",
      statusCode: 502,
    });
  }

  return {
    user: data.user,
    socialAccount: data.socialAccount ?? null,
    traderProfile: data.traderProfile ?? null,
  } satisfies TelegramUserSession;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
