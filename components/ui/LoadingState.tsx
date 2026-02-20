export default function LoadingState({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="page" style={{ justifyContent: "center" }}>
      <main className="page-content" style={{ textAlign: "center" }}>
        <div className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
          <div className="card-title">NEXT</div>
          <div className="card-muted">{message}</div>
        </div>
      </main>
    </div>
  );
}
