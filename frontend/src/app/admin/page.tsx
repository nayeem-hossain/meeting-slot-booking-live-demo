"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../lib/api-client";
import { useAuth } from "../../components/auth-provider";
import { Booking, Room } from "../../lib/types";
import { RoleGuard } from "../../components/role-guard";

interface RoomFormState {
  name: string;
  capacity: string;
  hourlyRate: string;
  features: string;
}

const initialRoomForm: RoomFormState = {
  name: "",
  capacity: "8",
  hourlyRate: "45",
  features: "Display, Whiteboard"
};

function toFeatureList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export default function AdminPage() {
  const { getRooms, getBookings, createRoom } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "CANCELLED">("ALL");
  const [roomForm, setRoomForm] = useState<RoomFormState>(initialRoomForm);
  const [loadingData, setLoadingData] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminData() {
      setLoadingData(true);
      setError(null);

      try {
        const [roomData, bookingData] = await Promise.all([getRooms(), getBookings()]);
        if (cancelled) {
          return;
        }

        setRooms(roomData);
        setBookings(bookingData);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        if (loadError instanceof ApiError) {
          setError(loadError.message);
        } else if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError("Unable to load admin workspace data.");
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    }

    void loadAdminData();

    return () => {
      cancelled = true;
    };
  }, [getRooms, getBookings]);

  const metrics = useMemo(() => {
    const activeBookings = bookings.filter((booking) => booking.status === "ACTIVE").length;
    const cancelledBookings = bookings.filter((booking) => booking.status === "CANCELLED").length;
    const totalRevenue = bookings
      .filter((booking) => booking.status === "ACTIVE")
      .reduce((sum, booking) => sum + booking.totalPrice, 0);

    return {
      roomCount: rooms.length,
      bookingCount: bookings.length,
      activeBookings,
      cancelledBookings,
      totalRevenue
    };
  }, [rooms, bookings]);

  const filteredBookings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return bookings
      .filter((booking) => {
        if (statusFilter !== "ALL" && booking.status !== statusFilter) {
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
      .sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime());
  }, [bookings, query, statusFilter]);

  function handleRoomFieldChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setRoomForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const capacity = Number(roomForm.capacity);
    const hourlyRate = Number(roomForm.hourlyRate);
    const features = toFeatureList(roomForm.features);

    if (!roomForm.name.trim()) {
      setError("Room name is required.");
      return;
    }

    if (!Number.isFinite(capacity) || capacity <= 0 || !Number.isInteger(capacity)) {
      setError("Capacity must be a positive whole number.");
      return;
    }

    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
      setError("Hourly rate must be a positive number.");
      return;
    }

    setCreating(true);
    setError(null);
    setMessage(null);

    try {
      const created = await createRoom({
        name: roomForm.name.trim(),
        capacity,
        hourlyRate,
        features
      });

      setRooms((current) => [created, ...current]);
      setRoomForm(initialRoomForm);
      setMessage(`Room \"${created.name}\" created successfully.`);
    } catch (createError) {
      if (createError instanceof ApiError) {
        setError(createError.message);
      } else if (createError instanceof Error) {
        setError(createError.message);
      } else {
        setError("Unable to create room.");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <RoleGuard allowRoles={["ADMIN"]}>
      <div className="stack">
        <section className="card">
          <div className="sectionHeader">
            <div>
              <h2>Admin Console</h2>
              <p className="helperText">
                Monitor operations, onboard new rooms, and review booking activity in one place.
              </p>
            </div>
          </div>

          {loadingData ? (
            <p className="mutedText">Loading admin metrics...</p>
          ) : (
            <div className="kpiGrid">
              <article className="kpiCard">
                <span className="kpiLabel">Rooms</span>
                <span className="kpiValue">{metrics.roomCount}</span>
              </article>
              <article className="kpiCard">
                <span className="kpiLabel">Total Bookings</span>
                <span className="kpiValue">{metrics.bookingCount}</span>
              </article>
              <article className="kpiCard">
                <span className="kpiLabel">Active Bookings</span>
                <span className="kpiValue">{metrics.activeBookings}</span>
              </article>
              <article className="kpiCard">
                <span className="kpiLabel">Cancelled Bookings</span>
                <span className="kpiValue">{metrics.cancelledBookings}</span>
              </article>
              <article className="kpiCard">
                <span className="kpiLabel">Active Revenue</span>
                <span className="kpiValue">${metrics.totalRevenue.toFixed(2)}</span>
              </article>
            </div>
          )}
        </section>

        <section className="card">
          <h3>Create Room</h3>
          <p className="helperText">Add room inventory with pricing and feature labels.</p>

          <form className="formGrid" onSubmit={handleCreateRoom}>
            <div className="filterGrid formGridColumns">
              <label className="fieldLabel">
                Room Name
                <input
                  className="input"
                  name="name"
                  value={roomForm.name}
                  onChange={handleRoomFieldChange}
                  placeholder="Ocean View Boardroom"
                  required
                />
              </label>

              <label className="fieldLabel">
                Capacity
                <input
                  className="input"
                  name="capacity"
                  type="number"
                  min={1}
                  step={1}
                  value={roomForm.capacity}
                  onChange={handleRoomFieldChange}
                  required
                />
              </label>

              <label className="fieldLabel">
                Hourly Rate (USD)
                <input
                  className="input"
                  name="hourlyRate"
                  type="number"
                  min={1}
                  step={0.01}
                  value={roomForm.hourlyRate}
                  onChange={handleRoomFieldChange}
                  required
                />
              </label>

              <label className="fieldLabel">
                Features (comma separated)
                <input
                  className="input"
                  name="features"
                  value={roomForm.features}
                  onChange={handleRoomFieldChange}
                  placeholder="Display, Whiteboard, Video Conference"
                />
              </label>
            </div>

            <div className="inlineActions">
              <button type="submit" className="button" disabled={creating}>
                {creating ? "Creating..." : "Create Room"}
              </button>
              <button
                type="button"
                className="button buttonGhost"
                onClick={() => {
                  setRoomForm(initialRoomForm);
                  setMessage(null);
                  setError(null);
                }}
                disabled={creating}
              >
                Reset
              </button>
            </div>
          </form>

          {error && <p className="errorText">{error}</p>}
          {message && <p className="successText">{message}</p>}
        </section>

        <section className="card">
          <div className="sectionHeader">
            <div>
              <h3>Bookings Overview</h3>
              <p className="helperText">Filter by status and search by room, user, or booking ID.</p>
            </div>
            <div className="inlineActions">
              <input
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search bookings"
              />
              <select
                className="input"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "CANCELLED")}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="emptyState">No bookings match current filters.</div>
          ) : (
            <div className="tableWrap">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>User</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.slice(0, 18).map((booking) => (
                    <tr key={booking.id}>
                      <td>{booking.room?.name ?? "Room"}</td>
                      <td>
                        <div>{booking.user?.name ?? "Unknown"}</div>
                        <small className="mutedText">{booking.user?.email ?? ""}</small>
                      </td>
                      <td>{new Date(booking.startTime).toLocaleString()}</td>
                      <td>{new Date(booking.endTime).toLocaleString()}</td>
                      <td>${booking.totalPrice.toFixed(2)}</td>
                      <td>
                        <span className={`tag ${booking.status === "ACTIVE" ? "tagActive" : "tagCancelled"}`}>
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </RoleGuard>
  );
}
