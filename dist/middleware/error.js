export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
export function asyncHandler(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
export function notFound(_req, res) {
    res.status(404).json({ error: "No encontrado" });
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof ApiError) {
        return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
}
