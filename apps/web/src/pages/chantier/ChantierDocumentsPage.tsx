import { FormEvent, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { UserRole } from "@proactif-field/shared";
import { useDeleteDocument, useDocuments, useUploadDocument } from "../../api/hooks";
import { apiFetchBlob, ApiError } from "../../api/client";
import { useAuthStore } from "../../auth/store";
import AutocompleteInput from "../../components/AutocompleteInput";
import DocumentPreview from "../../components/DocumentPreview";
import Icon from "../../components/Icon";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function ChantierDocumentsPage() {
  const { chantierId } = useParams<{ chantierId: string }>();
  const { data: documents, isLoading } = useDocuments(chantierId);
  const uploadDocument = useUploadDocument(chantierId);
  const deleteDocument = useDeleteDocument(chantierId);
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [author, setAuthor] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ id: string; fileName: string } | null>(null);

  function resetForm() {
    setFile(null);
    setCategory("");
    setName("");
    setVersion("");
    setAuthor("");
    setCommentaire("");
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file || !category.trim() || !name.trim()) return;
    const form = new FormData();
    form.append("file", file);
    form.append("category", category);
    form.append("name", name);
    if (version) form.append("version", version);
    if (author) form.append("author", author);
    if (commentaire) form.append("commentaire", commentaire);
    try {
      await uploadDocument.mutateAsync(form);
      resetForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'import");
    }
  }

  async function download(id: string, fileName: string) {
    setDownloadingId(id);
    try {
      const blob = await apiFetchBlob(`/api/files/documents/${id}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce document ?")) return;
    await deleteDocument.mutateAsync(id);
  }

  return (
    <div className="page">
      {isAdmin && (
        <button className="btn block" onClick={() => setShowForm((v) => !v)} style={{ marginBottom: 16 }}>
          {showForm ? "Annuler" : "+ Ajouter un document"}
        </button>
      )}

      {showForm && (
        <form onSubmit={submit} className="card">
          {error && <div className="error-banner">{error}</div>}
          <div className="field">
            <label>Fichier</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div className="field">
            <label>Catégorie</label>
            <AutocompleteInput
              field="document.category"
              value={category}
              onChange={setCategory}
              placeholder="ex: Plans, Documents techniques, Sécurité…"
              required
            />
          </div>
          <div className="field">
            <label>Nom du document</label>
            <AutocompleteInput field="document.name" value={name} onChange={setName} required />
          </div>
          <div className="field">
            <label>Version (optionnel)</label>
            <input value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div className="field">
            <label>Auteur / émetteur (optionnel)</label>
            <AutocompleteInput field="document.author" value={author} onChange={setAuthor} />
          </div>
          <div className="field">
            <label>Commentaire (optionnel)</label>
            <textarea rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          </div>
          <button className="btn block" type="submit" disabled={uploadDocument.isPending}>
            {uploadDocument.isPending ? "Import…" : "Importer"}
          </button>
        </form>
      )}

      {isLoading && <p>Chargement…</p>}
      {documents?.length === 0 && <p style={{ color: "var(--ink-muted)" }}>Aucun document pour l'instant.</p>}
      {documents?.map((doc) => (
        <div key={doc.id} className="card user-card">
          <div style={{ cursor: "pointer" }} onClick={() => setPreviewDoc({ id: doc.id, fileName: doc.fileName })}>
            <h3>{doc.name}</h3>
            <p>
              {doc.category}
              {doc.version ? ` · v${doc.version}` : ""} · {formatDateTime(doc.createdAt)} · par{" "}
              {doc.uploadedByName}
            </p>
            {doc.commentaire && <p>{doc.commentaire}</p>}
          </div>
          <div className="user-card-actions">
            <button
              className="btn secondary"
              onClick={() => setPreviewDoc({ id: doc.id, fileName: doc.fileName })}
            >
              <Icon name="eye" />
            </button>
            <button
              className="btn secondary"
              onClick={() => download(doc.id, doc.fileName)}
              disabled={downloadingId === doc.id}
            >
              {downloadingId === doc.id ? "…" : "⬇️"}
            </button>
            {isAdmin && (
              <button className="btn danger" onClick={() => handleDelete(doc.id)}>
                Suppr.
              </button>
            )}
          </div>
        </div>
      ))}

      {previewDoc && (
        <DocumentPreview
          documentId={previewDoc.id}
          fileName={previewDoc.fileName}
          onClose={() => setPreviewDoc(null)}
          onDownload={() => download(previewDoc.id, previewDoc.fileName)}
        />
      )}
    </div>
  );
}
