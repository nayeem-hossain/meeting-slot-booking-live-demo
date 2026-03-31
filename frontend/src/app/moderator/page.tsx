"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../lib/api-client";
import { useAuth } from "../../components/auth-provider";
import { Booking } from "../../lib/types";
import { RoleGuard } from "../../components/role-guard";

type BookingLifecycle = "BOOKED" | "COMPLETED" | "CANCELLED";

function getBookingLifecycleStatus(booking: Booking): BookingLifecycle {
  if (booking.status === "CANCELLED") {
    return "CANCELLED";
  }

  if (new Date(booking.endTime).getTime() < Date.now()) {
    return "COMPLETED";
  }

  return "BOOKED";
}

export default function ModeratorPage() {
  const { getBookings, cancelBooking } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | BookingLifecycle>("BOOKED");
  const [loadingData, setLoadingData] = useState(true);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBookings() {
      setLoadingData(true);
      setError(null);

      try {
        const bookingData = await getBookings();
        if (!cancelled) {
          setBookings(bookingData);
        }
      } catch (loadError) {
        if (!cancelled) {
          if (loadError instanceof ApiError) {
            setError(loadError.message);
          } else if (loadError instanceof Error) {
            setError(loadError.message);
          } else {
            setError("Unable to load booking moderation data.");
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    }

    void loadBookings();

    return () => {
      cancelled = true;
    };
  }, [getBookings]);

  const stats = useMemo(() => {
    const bookedBookings = bookings.filter((booking) => getBookingLifecycleStatus(booking) === "BOOKED").length;
    const completedBookings = bookings.filter((booking) => getBookingLifecycleStatus(booking) === "COMPLETED").length;
    const cancelledBookings = bookings.filter((booking) => booking.status === "CANCELLED").length;
    const uniqueRooms = new Set(bookings.map((booking) => booking.roomId)).size;

    return {
      total: bookings.length,
      bookedBookings,
      completedBookings,
      cancelledBookings,
      uniqueRooms
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return bookings
      .filter((booking) => {
        const lifecycle = getBookingLifecycleStatus(booking);

        if (statusFilter !== "ALL" && lifecycle !== statusFilter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const roomName = booking.room?.name?.toLowerCase() ?? "";
        const userName = booking.user?.name?.toLowerCase() ?? "";
        const userEmail = booking.user?.email?.toLowerCase() ?? "";

        return roomName.includes(normalizedQuery)
          || userName.includes(normalizedQuery)
          || userEmail.includes(normalizedQuery)
          || booking.id.toLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
  }, [bookings, query, statusFilter]);

  async function handleCancel(bookingId: string) {
    setBusyBookingId(bookingId);
    setError(null);
    setMessage(null);

    try {
      const updated = await cancelBooking(bookingId);
      setBookings((current) => current.map((booking) => (booking.id === updated.id ? updated : booking)));
      setMessage(`Booking ${bookingId.slice(0, 8)}... cancelled.`);
    } catch (cancelError) {
      if (cancelError instanceof ApiError) {
        setError(cancelError.message);
      } else if (cancelError instanceof Error) {
        setError(cancelError.message);
      } else {
        setError("Unable to cancel booking.");
      }
    } finally {
      setBusyBookingId(null);
    }
  }

  function handleMarkReviewed(bookingId: string) {
    setReviewedBookingIds((current) => {
      const next = new Set(current);
      next.add(bookingId);
      return next;
    });
    setMessage(`Booking ${bookingId.slice(0, 8)}... marked as reviewed.`);
  }

  return (
    <RoleGuard allowRoles={["MODERATOR", "ADMIN"]}>
      <div className="stack">
        <section className="card moderatorConsoleCard">
          <div className="sectionHeader">
            <div>
              <h2>Moderator Console</h2>
              <p className="helperText">Manage booking incidents, resolve collisions, and cancel invalid reservations.</p>
            </div>
            <span className="consoleBadge consoleBadgeModerator">Moderation Queue</span>
          </div>

          {loadingData ? (
            <p className="mutedText">Loading moderation queue...</p>
          ) : (
            <div className="kpiGrid">
              <article className="kpiCard">
                <span className="kpiLabel">Total Bookings</span>
                <span className="kpiValue">{stats.total}</span>
              </article>
              <article className="kpiCard">
                <span className="kpiLabel">Booked</span>
                <span className="kpiValue">{stats.bookedBookings}</span>
              </article>
              <article className="kpiCard">
                <span className="kpiLabel">Completed</span>
                <span className="kpiValue">{stats.completedBookings}</span>
              </article>
              <article className="kpiCard">
                <span className="kpiLabel">Cancelled</span>
                <span className="kpiValue">{stats.cancelledBookings}</span>
              </article>
              <article className="kpiCard">
                <span className="kpiLabel">Rooms Affected</span>
                <span className="kpiValue">{stats.uniqueRooms}</span>
              </article>
            </div>
          )}
        </section>

        <section className="card moderatorConsoleCard">
          <div className="sectionHeader">
            <div>
              <h3>Moderation Queue</h3>
              <p className="helperText">Filter and act on active reservations. Cancellation propagates realtime updates automatically.</p>
            </div>
            <div className="inlineActions">
              <input
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search room, user, or booking ID"
              />
              <select
                className="input"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "ALL" | BookingLifecycle)}
              >
                <option value="ALL">All lifecycle states</option>
                <option value="BOOKED">Booked only</option>
                <option value="COMPLETED">Completed only</option>
                <option value="CANCELLED">Cancelled only</option>
              </select>
            </div>
          </div>

          {error && <p className="errorText">{error}</p>}
          {message && <p className="successText">{message}</p>}

          {filteredBookings.length === 0 ? (
            <div className="emptyState">No booking records match current moderation filters.</div>
          ) : (
            <div className="tableWrap">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Room</th>
                    <th>User</th>
                    <th>Window</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Lifecycle</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => {
                    const lifecycle = getBookingLifecycleStatus(booking);
                    const cancellable = lifecycle === "BOOKED";
                    const reviewed = reviewedBookingIds.has(booking.id);
                    const lifecycleClass = lifecycle === "BOOKED"
                      ? "tagBooked"
                      : lifecycle === "COMPLETED"
                        ? "tagCompleted"
                        : "tagCancelled";

                    return (
                      <tr key={booking.id} className={reviewed ? "rowReviewed" : ""}>
                        <td>{booking.id.slice(0, 8)}...</td>
                        <td>{booking.room?.name ?? "Room"}</td>
                        <td>
                          <div>{booking.user?.name ?? "Unknown"}</div>
                          <small className="mutedText">{booking.user?.email ?? ""}</small>
                        </td>
                        <td>
                          <div>{new Date(booking.startTime).toLocaleString()}</div>
                          <small className="mutedText">to {new Date(booking.endTime).toLocaleString()}</small>
                        </td>
                        <td>${booking.totalPrice.toFixed(2)}</td>
                        <td>
                          <span className={`tag ${booking.status === "ACTIVE" ? "tagActive" : "tagCancelled"}`}>
                            {booking.status}
                          </span>
                        </td>
                        <td>
                          <span className={`tag ${lifecycleClass}`}>{lifecycle}</span>
                        </td>
                        <td>
                          <div className="inlineActions">
                            <button
                              type="button"
                              className="button buttonSecondary"
                              disabled={!cancellable || busyBookingId === booking.id}
                              onClick={() => {
                                void handleCancel(booking.id);
                              }}
                            >
                              {busyBookingId === booking.id ? "Cancelling..." : "Cancel"}
                            </button>
                            <button
                              type="button"
                              className="button buttonGhost"
                              disabled={reviewed}
                              onClick={() => handleMarkReviewed(booking.id)}
                            >
                              {reviewed ? "Reviewed" : "Mark Reviewed"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </RoleGuard>
  );
}
