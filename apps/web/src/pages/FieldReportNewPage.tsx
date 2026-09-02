import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateFieldReport } from "../api/fieldReportHooks";
import { getCurrentPositionSafe, GpsPosition } from "../utils/geolocation";
import AutocompleteInput from "../components/AutocompleteInput";
import Icon from "../components/Icon";

function defaultName(): string {
  return `Rapport du ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}`;
}

export default function FieldReportNewPage() {
  const navigate = useNavigate();
  const createReport = useCreateFieldReport();
  const [nom, setNom] = useState(defaultName());
  const [typeTravaux, setTypeTravaux] = useState("");
  const [observation, setObservation] = useState("");
  const [lieu, setLieu] = useState("");
  const [gps, setGps] = useState<GpsPosition | null>(null);
  const [gpsState, setGpsState] = useState<"locating" | "found" | "unavailable">("locating");

  useEffect(() => {
    let cancelled = false;
    getCurrentPositionSafe().then((position) => {
      if (cancelled) return;
      setGps(position);
      setGpsState(position ? "found" : "unavailable");
    });
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim() || createReport.isPending) return;
    const rapport = await createReport.mutateAsync({
      nom: nom.trim(),
      typeTravaux: typeTravaux.trim() || null,
      observation: observation.trim() || null,
      lieu: lieu.trim() || null,
      latitude: gps?.lat ?? null,
      longitude: gps?.lng ?? null,
      gpsAccuracy: gps?.accuracy ?? null,
    });
    navigate(`/rapport-terrain/${rapport.id}`, { replace: true });
  }

  return (
    <div className="page field-report-new-page">
      <span className="section-title" style={{ margin: 0 }}>Rapport terrain</span>
      <h1 style={{ fontSize: 26, marginBottom: 18 }}>Nouveau rapport</h1>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Nom du rapport</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus />
        </div>

        <div className="field">
          <label>Type de travaux</label>
          <AutocompleteInput field="rapportTerrain.typeTravaux" value={typeTravaux} onChange={setTypeTravaux} placeholder="ex : maintenance réseau" />
        </div>

        <div className="field">
          <label>Lieu {gpsState === "locating" && "(localisation en cours…)"}</label>
          <AutocompleteInput field="rapportTerrain.lieu" value={lieu} onChange={setLieu} placeholder="ex : Rue de la Paix, Paris" />
          <small className={`gps-status gps-status-${gpsState}`}>
            {gpsState === "locating" && "Recherche de la position GPS…"}
            {gpsState === "found" && `GPS capturé (± ${Math.round(gps!.accuracy)} m)`}
            {gpsState === "unavailable" && "GPS indisponible — le rapport peut tout de même être créé."}
          </small>
        </div>

        <div className="field">
          <label>Observation générale (optionnel)</label>
          <AutocompleteInput field="rapportTerrain.observation" value={observation} onChange={setObservation} multiline rows={3} />
        </div>

        <button className="btn block" type="submit" disabled={!nom.trim() || createReport.isPending}>
          <Icon name="check" /> Créer le rapport
        </button>
      </form>
    </div>
  );
}
