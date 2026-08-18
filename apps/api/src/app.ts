import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/routes";
import { chantiersRouter } from "./modules/chantiers/routes";
import { chantierPlansRouter, plansRouter } from "./modules/plans/routes";
import { chantierPointsRouter, planPointsRouter, pointsRouter } from "./modules/points/routes";
import { pointPhotosRouter, photosRouter } from "./modules/photos/routes";
import { chantierReportsRouter, orgReportsRouter } from "./modules/reports/routes";
import { chantierDocumentsRouter, documentsRouter } from "./modules/documents/routes";
import { filesRouter } from "./modules/files/routes";
import { termsRouter } from "./modules/terms/routes";
import { usersRouter } from "./modules/users/routes";
import { dashboardRouter } from "./modules/dashboard/routes";

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: env.corsOrigins }));
  app.use(morgan("dev"));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);
  app.use("/api/chantiers", chantiersRouter);
  app.use("/api/chantiers/:id/plans", chantierPlansRouter);
  app.use("/api/chantiers/:id/reports", chantierReportsRouter);
  app.use("/api/chantiers/:id/documents", chantierDocumentsRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/plans", plansRouter);
  app.use("/api/plans/:id/points", planPointsRouter);
  app.use("/api/chantiers/:id/points", chantierPointsRouter);
  app.use("/api/points", pointsRouter);
  app.use("/api/points/:id/photos", pointPhotosRouter);
  app.use("/api/photos", photosRouter);
  app.use("/api/files", filesRouter);
  app.use("/api/terms", termsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/reports", orgReportsRouter);

  app.use(errorHandler);

  return app;
}
