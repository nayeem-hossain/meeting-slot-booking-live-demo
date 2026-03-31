import Link from "next/link";

const pillars = [
  {
    title: "Quarter-hour booking precision",
    detail: "Capture room usage in 15-minute blocks with consistent, validated slot math."
  },
  {
    title: "Role-aware operations",
    detail: "Keep user booking flow simple while moderator/admin workflows remain tightly controlled."
  },
  {
    title: "Live availability reliability",
    detail: "Socket updates and overlap checks keep room state accurate under concurrent activity."
  },
  {
    title: "Background reminder pipeline",
    detail: "Confirmation, cancellation, and delayed reminder jobs are queued and observed in worker logs."
  }
];

const roadmap = [
  "Finish moderator and admin CRUD workflows.",
  "Harden security around auth rate-limits and token reuse detection.",
  "Expand retry/dead-letter controls for worker reliability."
];

export default function HomePage() {
  return (
    <div className="stack">
      <section className="heroCard">
        <p className="brandKicker">Frontend Refresh - Phase Active</p>
        <h2 className="heroLead">A faster, clearer workspace booking interface built for real operations.</h2>
        <p className="heroMeta">
          This frontend is now aligned to your production backend behavior: realtime occupancy updates,
          role-aware access, and queue-backed notifications.
        </p>
        <div className="heroActions">
          <Link href="/bookings" className="button">
            Open Bookings Grid
          </Link>
          <Link href="/moderator" className="button buttonGhost">
            Moderator Console
          </Link>
          <Link href="/admin" className="button buttonSecondary">
            Admin Console
          </Link>
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h3>Platform Strengths</h3>
            <p className="helperText">Implementation-ready capabilities already wired to your backend.</p>
          </div>
        </div>
        <div className="featureGrid">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="featureCard">
              <h4>{pillar.title}</h4>
              <p className="helperText">{pillar.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Next Milestones</h3>
        <p className="helperText">Immediate priorities from the active phase plan:</p>
        <ol>
          {roadmap.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
