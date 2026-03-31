import Link from "next/link";

const highlights = [
  {
    title: "Precision timing",
    detail: "Book rooms in exact 15-minute blocks for reliable schedule control.",
    icon: "15"
  },
  {
    title: "Conflict-safe booking",
    detail: "Overlap validation protects availability when multiple people reserve at once.",
    icon: "OK"
  },
  {
    title: "Live awareness",
    detail: "Availability state refreshes quickly so booking decisions stay accurate.",
    icon: "LIVE"
  },
  {
    title: "Role-protected operations",
    detail: "Admin and moderation routes are protected and not exposed in public navigation.",
    icon: "RBAC"
  }
];

const howToUse = [
  {
    title: "Create your account",
    detail: "Open Sign in and register with name, email, and password."
  },
  {
    title: "Choose room and date",
    detail: "Go to Bookings, pick a room, select a date, and set duration blocks."
  },
  {
    title: "Reserve an available slot",
    detail: "Tap a green slot from the grid to create the booking instantly."
  },
  {
    title: "Manage your reservations",
    detail: "Use My Bookings to review or cancel active reservations."
  }
];

const guideNotes = [
  "All times are shown in UTC in the booking grid.",
  "Slot conflicts return immediate guidance and refresh availability.",
  "Role-protected pages are accessible only to authorized users via direct route."
];

export default function HomePage() {
  return (
    <div className="stack">
      <section className="heroCard heroGuide">
        <div className="logoBadge" aria-hidden>
          <span>MS</span>
        </div>
        <p className="brandKicker">Workspace Reservation Platform</p>
        <h2 className="heroLead">Book meeting spaces quickly, clearly, and with full visibility.</h2>
        <p className="heroMeta">
          This platform helps teams reserve rooms with precise 15-minute scheduling, transparent availability,
          and reliable booking history management.
        </p>
        <div className="heroActions">
          <Link href="/bookings" className="button">
            Start Booking
          </Link>
          <Link href="/login" className="button buttonGhost">
            Sign in or Register
          </Link>
        </div>
        <div className="heroVisual" aria-hidden>
          <div className="heroOrb heroOrbOne" />
          <div className="heroOrb heroOrbTwo" />
          <div className="heroOrb heroOrbThree" />
        </div>
      </section>

      <section className="card">
        <h3>How to use the platform</h3>
        <p className="helperText">Follow these steps for a smooth booking workflow.</p>
        <div className="guideGrid">
          {howToUse.map((step, index) => (
            <article key={step.title} className="guideCard" style={{ animationDelay: `${index * 0.08}s` }}>
              <span className="guideStep">Step {index + 1}</span>
              <h4>{step.title}</h4>
              <p className="helperText">{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h3>Platform highlights</h3>
            <p className="helperText">Core strengths that support daily room operations.</p>
          </div>
        </div>
        <div className="featureGrid">
          {highlights.map((item, index) => (
            <article key={item.title} className="featureCard featureCardShowcase" style={{ animationDelay: `${index * 0.06}s` }}>
              <span className="featureIcon" aria-hidden>{item.icon}</span>
              <h4>{item.title}</h4>
              <p className="helperText">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Usage notes</h3>
        <p className="helperText">Quick guidance for first-time users and demo sessions.</p>
        <ol>
          {guideNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
