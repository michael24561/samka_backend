import { verifyToken } from "../lib/jwt.js";
export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado" });
    }
    try {
        const payload = verifyToken(header.slice(7));
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({ error: "Token inválido o expirado" });
    }
}
export function requireAdmin(req, res, next) {
    const user = req.user;
    if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Acceso restringido a administradores" });
    }
    next();
}
