"use client";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main style={{ maxWidth: 520, margin: "15vh auto", padding: 32 }}>
      <h1>We couldn’t load this page.</h1>
      <p>Try loading the workspace again.</p>
      <button
        onClick={retry}
        style={{
          padding: "12px 18px",
          border: 0,
          borderRadius: 8,
          background: "#116e62",
          color: "white",
        }}
      >
        Try again
      </button>
    </main>
  );
}
