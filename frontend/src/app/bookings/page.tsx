"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { io } from "socket.io-client";
import { useAuth } from "../../components/auth-provider";
import { ApiError, getApiBaseUrl } from "../../lib/api-client";
import { formatSlot, generateDaySlots } from "../../lib/slots";
import { Booking, BusyInterval, Room } from "../../lib/types";

const MIN_BLOCKS = 1;
const MAX_BLOCKS = 16;

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOverlapping(start: Date, end: Date, interval: { startTime: string; endTime: string }): boolean {
  const bookingStart = new Date(interval.startTime);
  const bookingEnd = new Date(interval.endTime);
  return start < bookingEnd && end > bookingStart;
}

export default function BookingsPage() {
  const {
    user,
    isAuthenticated,
    loading,
    getRooms,
    getBookings,
    getAvailability,
    createBooking,
    cancelBooking
  } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busyIntervals, setBusyIntervals] = useState<BusyInterval[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [blockCount, setBlockCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<string | null>(null);

  const refreshBookings = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    const data = await getBookings();
    setBookings(data);
  }, [getBookings, isAuthenticated]);

  const refreshAvailability = useCallback(async () => {
    if (!isAuthenticated || !selectedRoomId) {
      setBusyIntervals([]);
      return;
    }

    const data = await getAvailability(selectedRoomId, selectedDate);
    setBusyIntervals(data.busyIntervals);
  }, [getAvailability, isAuthenticated, selectedRoomId, selectedDate]);

  const refreshRooms = useCallback(async () => {
    const data = await getRooms();
    setRooms(data);

    if (!selectedRoomId && data.length > 0) {
      setSelectedRoomId(data[0].id);
    }
  }, [getRooms, selectedRoomId]);

  useEffect(() => {
    if (loading) {
      return;
    }

    setError(null);
    setMessage(null);
    setConflictNotice(null);

    void refreshRooms().catch((loadError: unknown) => {
      if (loadError instanceof Error) {
        setError(loadError.message);
      } else {
        setError("Unable to load rooms.");
      }
    });

    if (!isAuthenticated) {
      setBookings([]);
      setBusyIntervals([]);
      return;
    }

    void refreshBookings().catch((loadError: unknown) => {
      if (loadError instanceof Error) {
        setError(loadError.message);
      } else {
        setError("Unable to load bookings.");
      }
    });
  }, [loading, isAuthenticated, refreshBookings, refreshRooms]);

  useEffect(() => {
    if (!isAuthenticated || !selectedRoomId) {
      setBusyIntervals([]);
      return;
    }

    void refreshAvailability().catch((loadError: unknown) => {
      if (loadError instanceof Error) {
        setError(loadError.message);
      } else {
        setError("Unable to load room availability.");
      }
    });
  }, [isAuthenticated, selectedRoomId, selectedDate, refreshAvailability]);

  useEffect(() => {
    if (!isAuthenticated || !selectedRoomId) {
      return;
    }

    const socket = io(getApiBaseUrl(), {
      transports: ["websocket"]
    });

    socket.emit("availability:watch-room", selectedRoomId);

    socket.on("availability:updated", (payload: { roomId: string; occurredAt: string }) => {
      if (payload.roomId !== selectedRoomId) {
        return;
      }

      setLastRealtimeUpdate(payload.occurredAt);
      setConflictNotice("Room availability changed. Please confirm your selected slot is still free.");
      void Promise.all([refreshBookings(), refreshAvailability()]).catch(() => {
        // Preserve current state when realtime refresh fails; users can manually retry.
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, selectedRoomId, refreshAvailability, refreshBookings]);

  const slots = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    return generateDaySlots(new Date(year, month - 1, day, 0, 0, 0, 0)).slice(28, 80);
  }, [selectedDate]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const selectedCalendarDate = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }, [selectedDate]);

  async function handleCreateBooking(startTimeIso: string) {
    if (!selectedRoomId || !isAuthenticated) {
      return;
    }

    const startTime = new Date(startTimeIso);
    const endTime = new Date(startTime.getTime() + blockCount * 15 * 60 * 1000);

    if (busyIntervals.some((interval) => isOverlapping(startTime, endTime, interval))) {
      setError("That slot overlaps an active booking.");
      setConflictNotice("Selected slot is no longer available. Choose a different time.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    setConflictNotice(null);

    try {
      const created = await createBooking({
        roomId: selectedRoomId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });

      setBookings((current) => [...current, created]);
      await refreshAvailability();
      setMessage(`Booking confirmed for ${formatSlot(startTime.toISOString())}.`);
    } catch (createError) {
      if (createError instanceof ApiError) {
        if (createError.status === 409) {
          setConflictNotice("That slot was just taken. Availability has been refreshed.");
          await Promise.all([refreshBookings(), refreshAvailability()]);
        }
        setError(createError.message);
      } else if (createError instanceof Error) {
        setError(createError.message);
      } else {
        setError("Unable to create booking.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    setConflictNotice(null);

    try {
      const updated = await cancelBooking(bookingId);
      setBookings((current) => current.map((booking) => (booking.id === updated.id ? updated : booking)));
      await refreshAvailability();
      setMessage("Booking cancelled.");
    } catch (cancelError) {
      if (cancelError instanceof ApiError) {
        setError(cancelError.message);
      } else if (cancelError instanceof Error) {
        setError(cancelError.message);
      } else {
        setError("Unable to cancel booking.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <section className="card">Loading session...</section>;
  }

  if (!isAuthenticated) {
    return (
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Sign in required</h2>
        <p style={{ color: "var(--muted)" }}>
          You need an account to create or manage booking slots.
        </p>
        <Link href="/login" className="button" style={{ display: "inline-block" }}>
          Go to Login
        </Link>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Create Booking</h2>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Signed in as {user?.name} ({user?.role})
        </p>

        <div className="filterGrid">
          <label className="fieldLabel">
            Room
            <select
              className="input"
              value={selectedRoomId}
              onChange={(event) => {
                setSelectedRoomId(event.target.value);
                setConflictNotice(null);
              }}
            >
              {rooms.length === 0 && <option value="">No rooms available</option>}
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} ({room.capacity} seats)
                </option>
              ))}
            </select>
          </label>

          <label className="fieldLabel">
            Date (UTC)
            <div className="calendarPanel">
              <DayPicker
                mode="single"
                selected={selectedCalendarDate}
                onSelect={(date) => {
                  if (!date) {
                    return;
                  }

                  setSelectedDate(toIsoDate(date));
                  setConflictNotice(null);
                }}
                weekStartsOn={1}
                disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
              />
            </div>
          </label>

          <label className="fieldLabel">
            Duration (15-min blocks)
            <input
              className="input"
              type="number"
              min={MIN_BLOCKS}
              max={MAX_BLOCKS}
              value={blockCount}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                if (!Number.isNaN(parsed)) {
                  setBlockCount(Math.max(MIN_BLOCKS, Math.min(MAX_BLOCKS, parsed)));
                }
              }}
            />
          </label>
        </div>

        {selectedRoom && (
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            Hourly Rate: ${selectedRoom.hourlyRate.toFixed(2)} | Estimated Price: ${((selectedRoom.hourlyRate * blockCount) / 4).toFixed(2)}
          </p>
        )}

        {lastRealtimeUpdate && (
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            Live update received at {new Date(lastRealtimeUpdate).toLocaleTimeString()}.
          </p>
        )}
      </section>

      {error && <p className="errorText">{error}</p>}
      {conflictNotice && <p className="warningText">{conflictNotice}</p>}
      {message && <p className="successText">{message}</p>}

      <section className="card">
        <h3 style={{ marginTop: 0 }}>15-minute Grid</h3>
        <div className="slotGrid">
          {slots.map((slotIso) => {
            const start = new Date(slotIso);
            const end = new Date(start.getTime() + blockCount * 15 * 60 * 1000);
            const unavailable = !selectedRoomId || busyIntervals.some((interval) => isOverlapping(start, end, interval));

            return (
              <button
                key={slotIso}
                type="button"
                className={unavailable ? "slotButton slotButtonUnavailable" : "slotButton"}
                disabled={busy || unavailable || !selectedRoomId}
                onClick={() => {
                  void handleCreateBooking(slotIso);
                }}
                title={unavailable ? "Unavailable" : "Book this slot"}
              >
                {formatSlot(slotIso)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>My Bookings</h3>
        {bookings.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No bookings yet.</p>
        ) : (
          <div className="stack">
            {bookings.map((booking) => (
              <article key={booking.id} className="bookingRow">
                <div>
                  <strong>{booking.room?.name ?? "Room"}</strong>
                  <p style={{ margin: "4px 0", color: "var(--muted)" }}>
                    {new Date(booking.startTime).toLocaleString()} - {new Date(booking.endTime).toLocaleString()}
                  </p>
                  <small style={{ color: "var(--muted)" }}>
                    {booking.status} | ${booking.totalPrice.toFixed(2)}
                  </small>
                </div>
                <button
                  type="button"
                  className="button buttonSecondary"
                  disabled={busy || booking.status !== "ACTIVE"}
                  onClick={() => {
                    void handleCancelBooking(booking.id);
                  }}
                >
                  Cancel
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
