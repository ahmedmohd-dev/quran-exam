"use client";

export default function OfflinePage() {
  return (
    <main className="login-page">
      <section className="login-card offline-card">
        <p className="eyebrow">OFFLINE</p>
        <h1>Connection unavailable</h1>
        <p>Your saved draft stays on this phone. Reconnect to continue and send changes securely.</p>
        <button type="button" onClick={() => window.location.reload()}>Try again</button>
      </section>
    </main>
  );
}
