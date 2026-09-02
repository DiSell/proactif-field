import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RapportTerrainItemDTO } from "@proactif-field/shared";
import { useUpdateFieldReportItem } from "../api/fieldReportHooks";
import { addLocalFieldReportItemPhoto, updateLocalFieldReportItemPhotoGps } from "../offline/fieldReports";
import { trySync } from "../offline/syncManager";
import { getCurrentPositionSafe } from "../utils/geolocation";
import AutocompleteInput from "./AutocompleteInput";
import Icon from "./Icon";
import PhotoCapture, { PhotoCaptureItem } from "./PhotoCapture";

interface Props {
  rapportId: string;
  item: RapportTerrainItemDTO;
  index: number;
  autoFocus?: boolean;
  /** True once the technician has tapped "Valider" on this entry. */
  validated?: boolean;
  /** Present only for the entry currently being filled in — shows the "Valider" button. */
  onValidate?: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function FieldReportItemCard({ rapportId, item, index, autoFocus = false, validated = false, onValidate }: Props) {
  const qc = useQueryClient();
  const updateItem = useUpdateFieldReportItem(rapportId);
  const [titre, setTitre] = useState(item.titre ?? "");
  const [commentaire, setCommentaire] = useState(item.commentaire ?? "");
  const [capturing, setCapturing] = useState(false);

  function saveField(patch: Partial<{ titre: string; commentaire: string }>) {
    updateItem.mutate({ id: item.id, input: patch });
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["field-reports", rapportId] });
  }

  // Same two-step flow as PointFiche's photo capture: save the photo
  // immediately (no waiting on GPS) so the button frees up right away, then
  // attach GPS in the background once it resolves.
  async function handleCapture(file: File) {
    setCapturing(true);
    try {
      const photo = await addLocalFieldReportItemPhoto(rapportId, item.id, file, null);
      invalidate();
      void trySync();
      getCurrentPositionSafe().then((gps) => {
        if (gps) void updateLocalFieldReportItemPhotoGps(rapportId, item.id, photo.id, gps).then(invalidate);
      });
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div className={`card field-report-item-card ${validated ? "field-report-item-validated" : ""}`}>
      <div className="chantier-point-card-header">
        <div className="section-title" style={{ margin: 0 }}>Entrée {index + 1} · {formatDateTime(item.capturedAt)}</div>
        {validated && <span className="field-report-validated-badge"><Icon name="check" size={14} /> Validée</span>}
      </div>
      <div className="field">
        <label>Ce qui a été photographié</label>
        <AutocompleteInput
          field="rapportTerrainItem.titre"
          value={titre}
          onChange={setTitre}
          onCommit={(v) => saveField({ titre: v })}
          placeholder="ex : regard endommagé"
          autoFocus={autoFocus}
        />
      </div>
      <div className="field">
        <label>Commentaire (optionnel)</label>
        <AutocompleteInput
          field="rapportTerrainItem.commentaire"
          value={commentaire}
          onChange={setCommentaire}
          onCommit={(v) => saveField({ commentaire: v })}
          multiline
          rows={2}
        />
      </div>
      <PhotoCapture
        fileKind="rapport-terrain-photos"
        title="Photos"
        capturing={capturing}
        onCapture={handleCapture}
        photos={item.photos.map((p): PhotoCaptureItem => ({ id: p.id, takenAt: p.takenAt, gpsLat: p.gpsLat, gpsLng: p.gpsLng, gpsAccuracy: p.gpsAccuracy }))}
      />
      {onValidate && (
        <button className="btn block field-report-validate-btn" onClick={onValidate} disabled={item.photos.length === 0}>
          <Icon name="check" /> Valider et prendre la photo suivante
        </button>
      )}
    </div>
  );
}
