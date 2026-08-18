import { Document, User } from "@prisma/client";
import { DocumentDTO } from "@proactif-field/shared";

type DocumentWithUploader = Document & { uploadedBy: User };

export function toDocumentDTO(doc: DocumentWithUploader): DocumentDTO {
  return {
    id: doc.id,
    chantierId: doc.chantierId,
    category: doc.category,
    name: doc.name,
    version: doc.version,
    date: doc.date ? doc.date.toISOString() : null,
    author: doc.author,
    commentaire: doc.commentaire,
    fileName: doc.fileName,
    uploadedById: doc.uploadedById,
    uploadedByName: doc.uploadedBy.name,
    createdAt: doc.createdAt.toISOString(),
  };
}
