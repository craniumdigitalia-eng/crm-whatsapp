import express from "express";
import path from "path";
import { config } from "./config";
import "./db"; // inicializa o banco
import { webhookRouter } from "./routes/webhook";
import { apiRouter } from "./routes/api";
import { startFollowUpEngine } from "./followup/scheduler";

const app = express();
app.use(express.json({ limit: "2mb" }));

// Dashboard (front-end estatico).
app.use(express.static(path.join(__dirname, "..", "public")));

// Rotas.
app.use("/webhook", webhookRouter);
app.use("/api", apiRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`\n  CRM WhatsApp rodando em http://localhost:${config.port}`);
  console.log(`  Dashboard:  http://localhost:${config.port}`);
  console.log(`  Webhook:    POST /webhook/evolution`);
  console.log(`  Modelo IA:  ${config.agentModel}\n`);
  startFollowUpEngine();
});
