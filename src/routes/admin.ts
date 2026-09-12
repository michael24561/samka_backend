import { Router } from "express";
import {
  listUsuarios,
  listRoles,
  updateUsuario,
  listMetodosPagoAdmin,
  createMetodoPago,
  updateMetodoPago,
  deleteMetodoPago,
  listResenasAdmin,
  deleteResena,
  listDireccionesAdmin,
  exportarReportesCsv,
} from "../controllers/adminController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const router = Router();

router.use(requireAuth, requireAdmin);

// Usuarios
router.get("/usuarios", asyncHandler(listUsuarios));
router.get("/roles", asyncHandler(listRoles));
router.patch("/usuarios/:id", asyncHandler(updateUsuario));

// Métodos de pago
router.get("/metodos-pago", asyncHandler(listMetodosPagoAdmin));
router.post("/metodos-pago", asyncHandler(createMetodoPago));
router.patch("/metodos-pago/:id", asyncHandler(updateMetodoPago));
router.delete("/metodos-pago/:id", asyncHandler(deleteMetodoPago));

// Reseñas
router.get("/resenas", asyncHandler(listResenasAdmin));
router.delete("/resenas/:id", asyncHandler(deleteResena));

// Direcciones
router.get("/direcciones", asyncHandler(listDireccionesAdmin));

// Reportes
router.get("/reportes/csv", asyncHandler(exportarReportesCsv));

export default router;
