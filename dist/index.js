import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { env } from "./env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import materialRoutes from "./routes/materials.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payments.js";
import workshopRoutes from "./routes/workshop.js";
import dashboardRoutes from "./routes/dashboard.js";
const app = express();
app.use(cors({
    origin: env.clientOrigin,
    credentials: true,
}));
app.use(express.json());
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "samka-api" }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/workshop", workshopRoutes);
app.use("/api/dashboard", dashboardRoutes);
function asyncErrorHandler(err, _req, res, _next) {
    if (err instanceof ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: err.errors });
    }
    errorHandler(err, _req, res, _next);
}
app.use(notFound);
app.use(asyncErrorHandler);
app.listen(env.port, () => {
    console.log(`Samka API escuchando en http://localhost:${env.port}`);
});
