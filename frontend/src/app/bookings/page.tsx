"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { io } from "socket.io-client";
import { useAuth } from "../../components/auth-provider";
import { ApiError, getApiBaseUrl } from "../../lib/api-client";
import { formatSlot, generateDaySlots } from "../../lib/slots";
import { AppRole, Booking, BusyInterval, Room } from "../../lib/types";

const MIN_BLOCKS = 1;
const MAX_BLOCKS = 16;
type BookingLifecycle = "BOOKED" | "COMPLETED" | "CANCELLED";

interface PendingBooking {
  startIso: string;
  endIso: string;
}

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

function getRoleBookingContext(role: AppRole | undefined): {
  heading: string;
  helper: string;
} {
  if (role === "ADMIN") {
    return {
      heading: "All Bookings (Admin Scope)",
      helper: "You can review and cancel bookings across all users."
    };
  }

  if (role === "MODERATOR") {
    return {
      heading: "All Bookings (Moderator Scope)",
      helper: "You can moderate and cancel bookings across all users."
    };
  }

  return {
    heading: "My Bookings",
    helper: "You can manage only your own reservations."
  };
}

function getBookingLifecycleStatus(booking: Booking): BookingLifecycle {
  if (booking.status === "CANCELLED") {
    return "CANCELLED";
  }

  if (new Date(booking.endTime).getTime() < Date.now()) {
    return "COMPLETED";
  }

  return "BOOKED";
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
  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(null);

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

  const roleContext = useMemo(() => getRoleBookingContext(user?.role), [user?.role]);
  const canAccessModeratorConsole = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const canAccessAdminConsole = user?.role === "ADMIN";

  const selectedCalendarDate = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }, [selectedDate]);

  const groupedBookings = useMemo(() => {
    const sorted = [...bookings].sort(
      (left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime()
    );

    return {
      booked: sorted.filter((booking) => getBookingLifecycleStatus(booking) === "BOOKED"),
      completed: sorted.filter((booking) => getBookingLifecycleStatus(booking) === "COMPLETED"),
      cancelled: sorted.filter((booking) => getBookingLifecycleStatus(booking) === "CANCELLED")
    };
  }, [bookings]);

  function handleSlotSelection(startTimeIso: string) {
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

    setPendingBooking({
      startIso: startTime.toISOString(),
      endIso: endTime.toISOString()
    });
    setError(null);
    setMessage(null);
    setConflictNotice(null);
  }

  async function handleCreateBooking() {
    if (!selectedRoomId || !isAuthenticated || !pendingBooking) {
      return;
    }

    const startTime = new Date(pendingBooking.startIso);
    const endTime = new Date(pendingBooking.endIso);

    if (busyIntervals.some((interval) => isOverlapping(startTime, endTime, interval))) {
      setPendingBooking(null);
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
        startTime: pendingBooking.startIso,
        endTime: pendingBooking.endIso
      });

      setBookings((current) => [...current, created]);
      setPendingBooking(null);
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

        {(canAccessModeratorConsole || canAccessAdminConsole) && (
          <div className="inlineActions" style={{ marginBottom: 14 }}>
            {canAccessModeratorConsole && (
              <Link href="/moderator" className="button buttonSecondary">
                Open Moderator Console
              </Link>
            )}
            {canAccessAdminConsole && (
              <Link href="/admin" className="button buttonGhost">
                Open Admin Console
              </Link>
            )}
          </div>
        )}

        <div className="bookingComposer">
          <div className="bookingControlStack">
            <label className="fieldLabel">
              Room
              <select
                className="input"
                value={selectedRoomId}
                onChange={(event) => {
                  setSelectedRoomId(event.target.value);
                  setPendingBooking(null);
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
              Duration (15-minute blocks)
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

            {selectedRoom && (
              <article className="roomInsightCard">
                <h4>{selectedRoom.name}</h4>
                <p className="helperText">Capacity: {selectedRoom.capacity} seats</p>
                <p className="helperText">Hourly Rate: ${selectedRoom.hourlyRate.toFixed(2)}</p>
                <p className="helperText">
                  Estimated Price: ${((selectedRoom.hourlyRate * blockCount) / 4).toFixed(2)}
                </p>
                <div className="roomFeatureList">
                  {selectedRoom.features.length === 0 ? (
                    <span className="tag">No listed features</span>
                  ) : (
                    selectedRoom.features.map((feature) => (
                      <span key={feature} className="tag">
                        {feature}
                      </span>
                    ))
                  )}
                </div>
              </article>
            )}
          </div>

          <div className="calendarPanel">
            <p className="helperText" style={{ marginBottom: 8 }}>Date</p>
            <DayPicker
              mode="single"
              selected={selectedCalendarDate}
              onSelect={(date) => {
                if (!date) {
                  return;
                }

                setSelectedDate(toIsoDate(date));
                setPendingBooking(null);
                setConflictNotice(null);
              }}
              weekStartsOn={1}
              disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
            />
          </div>
        </div>

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
                  handleSlotSelection(slotIso);
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
        <h3 style={{ marginTop: 0 }}>Booking Confirmation</h3>
        {!pendingBooking ? (
          <p className="helperText">Select a free time slot first. We will ask for confirmation before creating booking.</p>
        ) : (
          <div className="bookingConfirmPanel">
            <p className="helperText" style={{ marginBottom: 4 }}>
              Room: <strong>{selectedRoom?.name ?? "Room"}</strong>
            </p>
            <p className="helperText" style={{ marginBottom: 4 }}>
              Start: <strong>{new Date(pendingBooking.startIso).toLocaleString()}</strong>
            </p>
            <p className="helperText" style={{ marginBottom: 4 }}>
              End: <strong>{new Date(pendingBooking.endIso).toLocaleString()}</strong>
            </p>
            <p className="helperText" style={{ marginBottom: 0 }}>
              Estimated: <strong>${selectedRoom ? ((selectedRoom.hourlyRate * blockCount) / 4).toFixed(2) : "0.00"}</strong>
            </p>

            <div className="inlineActions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => {
                  void handleCreateBooking();
                }}
              >
                {busy ? "Confirming..." : "Confirm Booking"}
              </button>
              <button
                type="button"
                className="button buttonGhost"
                disabled={busy}
                onClick={() => setPendingBooking(null)}
              >
                Change Slot
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Room Details</h3>
        <p className="helperText">Review capacity, pricing, and feature tags before selecting a room.</p>
        {rooms.length === 0 ? (
          <p className="mutedText">No room inventory available.</p>
        ) : (
          <div className="featureGrid">
            {rooms.map((room) => (
              <article
                key={room.id}
                className="featureCard"
                style={room.id === selectedRoomId ? { borderColor: "#86c8ba", boxShadow: "0 0 0 3px rgba(119, 206, 188, 0.25)" } : undefined}
              >
                <h4 style={{ marginBottom: 6 }}>{room.name}</h4>
                <p className="helperText">Capacity: {room.capacity} seats</p>
                <p className="helperText">Rate: ${room.hourlyRate.toFixed(2)} / hour</p>
                <div className="roomFeatureList">
                  {room.features.length === 0 ? (
                    <span className="tag">No listed features</span>
                  ) : (
                    room.features.map((feature) => (
                      <span key={`${room.id}-${feature}`} className="tag">
                        {feature}
                      </span>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>{roleContext.heading}</h3>
        <p className="helperText">{roleContext.helper}</p>
        {bookings.length === 0 ? <p style={{ color: "var(--muted)" }}>No bookings yet.</p> : (
          <div className="bookingStatusGrid">
            <section className="statusBoard statusBoardBooked">
              <div className="sectionHeader">
                <h4 style={{ margin: 0 }}>Booked ({groupedBookings.booked.length})</h4>
                <span className="tag tagBooked">BOOKED</span>
              </div>
              {groupedBookings.booked.length === 0 ? <p className="helperText">No active bookings.</p> : groupedBookings.booked.map((booking) => (
                <article key={booking.id} className="bookingRow">
                  <div>
                    <strong>{booking.room?.name ?? "Room"}</strong>
                    <p style={{ margin: "4px 0", color: "var(--muted)" }}>
                      {new Date(booking.startTime).toLocaleString()} - {new Date(booking.endTime).toLocaleString()}
                    </p>
                    <small style={{ color: "var(--muted)" }}>
                      ${booking.totalPrice.toFixed(2)}
                      {(user?.role === "ADMIN" || user?.role === "MODERATOR") && booking.user
                        ? ` | ${booking.user.name} (${booking.user.email})`
                        : ""}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="button buttonSecondary"
                    disabled={busy}
                    onClick={() => {
                      void handleCancelBooking(booking.id);
                    }}
                  >
                    {user?.role === "USER" ? "Cancel" : "Cancel Booking"}
                  </button>
                </article>
              ))}
            </section>

            <section className="statusBoard statusBoardCompleted">
              <div className="sectionHeader">
                <h4 style={{ margin: 0 }}>Completed ({groupedBookings.completed.length})</h4>
                <span className="tag tagCompleted">COMPLETED</span>
              </div>
              {groupedBookings.completed.length === 0 ? <p className="helperText">No completed bookings.</p> : groupedBookings.completed.map((booking) => (
                <article key={booking.id} className="bookingRow">
                  <div>
                    <strong>{booking.room?.name ?? "Room"}</strong>
                    <p style={{ margin: "4px 0", color: "var(--muted)" }}>
                      {new Date(booking.startTime).toLocaleString()} - {new Date(booking.endTime).toLocaleString()}
                    </p>
                    <small style={{ color: "var(--muted)" }}>
                      ${booking.totalPrice.toFixed(2)}
                      {(user?.role === "ADMIN" || user?.role === "MODERATOR") && booking.user
                        ? ` | ${booking.user.name} (${booking.user.email})`
                        : ""}
                    </small>
                  </div>
                </article>
              ))}
            </section>

            <section className="statusBoard statusBoardCancelled">
              <div className="sectionHeader">
                <h4 style={{ margin: 0 }}>Cancelled ({groupedBookings.cancelled.length})</h4>
                <span className="tag tagCancelled">CANCELLED</span>
              </div>
              {groupedBookings.cancelled.length === 0 ? <p className="helperText">No cancelled bookings.</p> : groupedBookings.cancelled.map((booking) => (
                <article key={booking.id} className="bookingRow">
                  <div>
                    <strong>{booking.room?.name ?? "Room"}</strong>
                    <p style={{ margin: "4px 0", color: "var(--muted)" }}>
                      {new Date(booking.startTime).toLocaleString()} - {new Date(booking.endTime).toLocaleString()}
                    </p>
                    <small style={{ color: "var(--muted)" }}>
                      ${booking.totalPrice.toFixed(2)}
                      {(user?.role === "ADMIN" || user?.role === "MODERATOR") && booking.user
                        ? ` | ${booking.user.name} (${booking.user.email})`
                        : ""}
                    </small>
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
