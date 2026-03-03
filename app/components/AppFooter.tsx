import { APP_AUTHOR, APP_UPDATED_AT, APP_VERSION } from "@/lib/config/appInfo";

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <span>
        v{APP_VERSION} · Updated {APP_UPDATED_AT} · by {APP_AUTHOR}
      </span>
    </footer>
  );
}
