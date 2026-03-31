export type AppRole = "ADMIN" | "MODERATOR" | "USER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
}

export interface SessionTokens {
  token: string;
  refreshToken: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  features: string[];
  hourlyRate: number;
}

export interface Booking {
  id: string;
  userId: string;
  roomId: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: "ACTIVE" | "CANCELLED";
  room?: Room;
  user?: Pick<AuthUser, "id" | "name" | "email">;
}

export interface CreateBookingPayload {
  roomId: string;
  startTime: string;
  endTime: string;
}

export interface CreateRoomPayload {
  name: string;
  capacity: number;
  features: string[];
  hourlyRate: number;
}

export interface UpdateRoomPayload {
  name?: string;
  capacity?: number;
  features?: string[];
  hourlyRate?: number;
}

export interface BusyInterval {
  startTime: string;
  endTime: string;
}

export interface AvailabilityResponse {
  roomId: string;
  date: string;
  busyIntervals: BusyInterval[];
}
