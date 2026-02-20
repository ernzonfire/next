import QRCode from "react-qr-code";

export default function UserQRCode({ userId }: { userId: string }) {
  const value = `user:${userId}`;

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="card-title">Your Event QR</div>
      <div style={{ margin: "12px 0" }}>
        <QRCode value={value} size={180} />
      </div>
      <div className="card-muted">Show this at events to earn points.</div>
    </div>
  );
}
