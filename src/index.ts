import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { env } from "./env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { query } from "./db.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import categoryRoutes from "./routes/categories.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payments.js";
import dashboardRoutes from "./routes/dashboard.js";
import carritoRoutes from "./routes/carritos.js";
import favoritoRoutes from "./routes/favoritos.js";
import resenaRoutes from "./routes/resenas.js";
import direccionRoutes from "./routes/direcciones.js";
import adminRoutes from "./routes/admin.js";
import uploadRoutes, { UPLOAD_DIR } from "./routes/uploads.js";

const app = express();

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "12mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "samka-api" }));

app.use("/api/uploads", express.static(UPLOAD_DIR));
app.use("/api/uploads", uploadRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/carrito", carritoRoutes);
app.use("/api/favoritos", favoritoRoutes);
app.use("/api/resenas", resenaRoutes);
app.use("/api/direcciones", direccionRoutes);
app.use("/api/admin", adminRoutes);

function asyncErrorHandler(
  err: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Datos inválidos", details: err.errors });
  }
  errorHandler(err, _req, res, _next);
}

app.use(notFound);
app.use(asyncErrorHandler as express.ErrorRequestHandler);

async function cancelStalePendingOrders() {
  try {
    const { rowCount } = await query(
      `update public.pedidos set estado = 'cancelado', fecha_actualizacion = now()
       where estado = 'pendiente' and fecha_pedido < now() - interval '30 minutes'
       returning id_pedido`
    );
    if (rowCount) {
      console.log(`Auto-cancelados ${rowCount} pedidos pendientes (>30 min)`);
    }
  } catch {
    /* ignora errores en startup */
  }
}

app.listen(env.port, async () => {
  console.log(`Samka API escuchando en http://localhost:${env.port}`);
  await cancelStalePendingOrders();
});
