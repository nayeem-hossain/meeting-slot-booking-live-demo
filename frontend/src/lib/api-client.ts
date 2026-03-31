import {
  AvailabilityResponse,
  AuthResponse,
  Booking,
  CreateRoomPayload,
  UpdateRoomPayload,
  CreateBookingPayload,
  RefreshResponse,
  Room
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Keep default message when response body is empty or not JSON.
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function loginRequest(payload: { email: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: payload
  });
}

export function registerRequest(payload: { name: string; email: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: payload
  });
}

export function refreshRequest(refreshToken: string): Promise<RefreshResponse> {
  return request<RefreshResponse>("/api/auth/refresh", {
    method: "POST",
    body: { refreshToken }
  });
}

export function logoutRequest(refreshToken: string): Promise<void> {
  return request<void>("/api/auth/logout", {
    method: "POST",
    body: { refreshToken }
  });
}

export function getRoomsRequest(): Promise<Room[]> {
  return request<Room[]>("/api/rooms");
}

export function getBookingsRequest(token: string): Promise<Booking[]> {
  return request<Booking[]>("/api/bookings", { token });
}

export function getAvailabilityRequest(token: string, roomId: string, date: string): Promise<AvailabilityResponse> {
  const params = new URLSearchParams({ roomId, date });
  return request<AvailabilityResponse>(`/api/bookings/availability?${params.toString()}`, { token });
}

export function createBookingRequest(token: string, payload: CreateBookingPayload): Promise<Booking> {
  return request<Booking>("/api/bookings", {
    method: "POST",
    token,
    body: payload
  });
}

export function cancelBookingRequest(token: string, bookingId: string): Promise<Booking> {
  return request<Booking>(`/api/bookings/${bookingId}/cancel`, {
    method: "PATCH",
    token
  });
}

export function createRoomRequest(token: string, payload: CreateRoomPayload): Promise<Room> {
  return request<Room>("/api/rooms", {
    method: "POST",
    token,
    body: payload
  });
}

export function updateRoomRequest(token: string, roomId: string, payload: UpdateRoomPayload): Promise<Room> {
  return request<Room>(`/api/rooms/${roomId}`, {
    method: "PUT",
    token,
    body: payload
  });
}

export function deleteRoomRequest(token: string, roomId: string): Promise<void> {
  return request<void>(`/api/rooms/${roomId}`, {
    method: "DELETE",
    token
  });
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
