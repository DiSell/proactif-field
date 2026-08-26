import { useEffect, useState } from "react";
import { enablePushNotifications, pushIsEnabled, pushSupported } from "../pushNotifications";
import Icon from "./Icon";

const DISMISSED_KEY = "push-banner-dismissed";

// The account-menu toggle (AppLayout) still exists for anyone who goes
// looking, but nobody ever found it in practice — zero technicians had
// ever subscribed. This banner puts the same action somewhere a
// technician actually sees it, without auto-triggering the browser's
// permission prompt on load (that reads as spam and gets auto-denied).
export default function PushNotificationBanner() {
  const [enabled, setEnabled] = useState(true); // assume enabled until checked, to avoid a flash
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "true");
  const [denied, setDenied] = useState(false);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    setDenied(Notification.permission === "denied");
    void pushIsEnabled().then(setEnabled);
  }, []);

  if (!pushSupported() || enabled || denied || dismissed) return null;

  async function activate() {
    setActivating(true);
    setMessage(null);
    try {
      const result = await enablePushNotifications();
      if (result === "enabled") {
        setEnabled(true);
      } else if (result === "denied") {
        setDenied(true);
      } else {
        setMessage("Notifications indisponibles pour le moment.");
      }
    } catch {
      setMessage("Activation impossible.");
    } finally {
      setActivating(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  return (
    <div className="push-banner">
      <Icon name="warning" size={18} />
      <div className="push-banner-copy">
        <strong>Soyez alerté d'un nouveau chantier</strong>
        <span>{message ?? "Activez les notifications pour savoir immédiatement quand on vous affecte un chantier."}</span>
      </div>
      <div className="push-banner-actions">
        <button className="btn secondary" onClick={() => void activate()} disabled={activating}>
          {activating ? "Activation…" : "Activer"}
        </button>
        <button className="push-banner-dismiss" onClick={dismiss} aria-label="Ignorer">
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}
