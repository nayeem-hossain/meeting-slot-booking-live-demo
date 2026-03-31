"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  getAvailabilityRequest,
  ApiError,
  cancelBookingRequest,
  createRoomRequest,
  createBookingRequest,
  getBookingsRequest,
  getRoomsRequest,
  loginRequest,
  logoutRequest,
  refreshRequest,
  registerRequest
} from "../lib/api-client";
import {
  AuthResponse,
  AuthUser,
  AvailabilityResponse,
  Booking,
  CreateRoomPayload,
  CreateBookingPayload,
  Room,
  SessionTokens
} from "../lib/types";

interface SessionState {
  user: AuthUser;
  tokens: SessionTokens;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getRooms: () => Promise<Room[]>;
  getBookings: () => Promise<Booking[]>;
  getAvailability: (roomId: string, date: string) => Promise<AvailabilityResponse>;
  createBooking: (payload: CreateBookingPayload) => Promise<Booking>;
  cancelBooking: (bookingId: string) => Promise<Booking>;
  createRoom: (payload: CreateRoomPayload) => Promise<Room>;
}

const STORAGE_KEY = "meeting-slot-session";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredSession(): SessionState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<SessionState | null>(null);

  const commitSession = useCallback((next: SessionState | null) => {
    sessionRef.current = next;
    setSession(next);

    if (typeof window !== "undefined") {
      if (next) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const stored = readStoredSession();
    commitSession(stored);
    setLoading(false);
  }, [commitSession]);

  const setFromAuthResponse = useCallback((payload: AuthResponse) => {
    commitSession({
      user: payload.user,
      tokens: {
        token: payload.token,
        refreshToken: payload.refreshToken
      }
    });
  }, [commitSession]);

  const login = useCallback(async (email: string, password: string) => {
    const payload = await loginRequest({ email, password });
    setFromAuthResponse(payload);
  }, [setFromAuthResponse]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const payload = await registerRequest({ name, email, password });
    setFromAuthResponse(payload);
  }, [setFromAuthResponse]);

  const logout = useCallback(async () => {
    const current = sessionRef.current;
    if (current) {
      try {
        await logoutRequest(current.tokens.refreshToken);
      } catch {
        // Logout should clear local session even if server revoke fails.
      }
    }

    commitSession(null);
  }, [commitSession]);

  const withAuth = useCallback(async <T,>(operation: (token: string) => Promise<T>): Promise<T> => {
    const current = sessionRef.current;
    if (!current) {
      throw new Error("Please login to continue.");
    }

    try {
      return await operation(current.tokens.token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }

      const refreshed = await refreshRequest(current.tokens.refreshToken);
      const updated: SessionState = {
        user: current.user,
        tokens: {
          token: refreshed.token,
          refreshToken: refreshed.refreshToken
        }
      };

      commitSession(updated);
      return operation(updated.tokens.token);
    }
  }, [commitSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    isAuthenticated: Boolean(session),
    loading,
    login,
    register,
    logout,
    getRooms: () => getRoomsRequest(),
    getBookings: () => withAuth((token) => getBookingsRequest(token)),
    getAvailability: (roomId, date) => withAuth((token) => getAvailabilityRequest(token, roomId, date)),
    createBooking: (payload) => withAuth((token) => createBookingRequest(token, payload)),
    cancelBooking: (bookingId) => withAuth((token) => cancelBookingRequest(token, bookingId)),
    createRoom: (payload) => withAuth((token) => createRoomRequest(token, payload))
  }), [session, loading, login, register, logout, withAuth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
