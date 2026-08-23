import { useParams } from "react-router-dom";
import { UserRole } from "@proactif-field/shared";
import { useAssignChantier, useChantier, useUnassignChantier, useUsers } from "../../api/hooks";
import { useAuthStore } from "../../auth/store";

export default function ChantierEquipePage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: chantier } = useChantier(chantierId);
  const { data: users } = useUsers();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const assign = useAssignChantier(chantierId);
  const unassign = useUnassignChantier(chantierId);

  const technicians = users?.filter((u) => u.role === UserRole.TECHNICIEN) ?? [];
  const responsable = users?.find((u) => u.id === chantier?.responsableId);

  return (
    <div className="page">
      <h2 className="section-title" style={{ marginTop: 0 }}>Responsable</h2>
      <p>{responsable ? responsable.name : "Aucun responsable désigné."}</p>

      <h2 className="section-title">Techniciens assignés</h2>
      {!isAdmin && (
        <>
          {(chantier?.assignedUserIds.length ?? 0) === 0 && (
            <p style={{ color: "var(--ink-muted)" }}>Aucun technicien assigné.</p>
          )}
          {technicians
            .filter((t) => chantier?.assignedUserIds.includes(t.id))
            .map((t) => (
              <div key={t.id} className="card">
                <h3>{t.name}</h3>
                <p>{t.email}</p>
              </div>
            ))}
        </>
      )}

      {isAdmin && (
        <>
          {technicians.length === 0 && (
            <p style={{ color: "var(--ink-muted)" }}>
              Aucun technicien dans l'entreprise. Ajoutes-en depuis la page "Utilisateurs".
            </p>
          )}
          {technicians.map((tech) => {
            const isAssigned = chantier?.assignedUserIds.includes(tech.id) ?? false;
            return (
              <label key={tech.id} className="assign-row">
                <input
                  type="checkbox"
                  checked={isAssigned}
                  onChange={() => (isAssigned ? unassign.mutate(tech.id) : assign.mutate(tech.id))}
                />
                <span>{tech.name}</span>
                <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>{tech.email}</span>
              </label>
            );
          })}
        </>
      )}
    </div>
  );
}
