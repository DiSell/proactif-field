import { useState } from "react";

export default function AdminParametresPage() {
  const [gants, setGants] = useState(() => document.documentElement.classList.contains("gants"));
  function toggleGants() {
    const next = !gants;
    setGants(next);
    document.documentElement.classList.toggle("gants", next);
  }
  return (
    <>
      <div className="topbar">
        <h1>Paramètres</h1>
      </div>
      <div className="page">
        <div className="card">
          <h3>Usage terrain</h3>
          <p>Agrandit les commandes principales pour une utilisation avec des gants.</p>
          <button className={`btn ${gants ? "" : "secondary"}`} onClick={toggleGants} aria-pressed={gants} style={{ marginTop: 16 }}>
            Mode gants : {gants ? "activé" : "désactivé"}
          </button>
        </div>
      </div>
    </>
  );
}
