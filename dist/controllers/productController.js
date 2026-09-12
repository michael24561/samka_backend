import { query } from "../db.js";
import { ApiError } from "../middleware/error.js";
import { productSchema } from "../lib/validators/product.js";
export async function listProducts(req, res) {
    const { featured, category, search } = req.query;
    const params = [];
    const where = [];
    if (featured === "true")
        where.push("p.featured = true");
    if (category) {
        params.push(category);
        where.push(`c.slug = $${params.length}`);
    }
    if (search) {
        params.push(`%${search}%`);
        where.push(`(p.name ilike $${params.length} or p.description ilike $${params.length})`);
    }
    const whereSql = where.length ? "where " + where.join(" and ") : "";
    const { rows } = await query(`select p.*, c.name as category_name, c.slug as category_slug
     from public.products p
     left join public.categories c on c.id = p.category_id
     ${whereSql}
     order by p.featured desc, p.created_at desc`, params);
    res.json({ products: rows });
}
export async function getProduct(req, res) {
    const { slug } = req.params;
    const { rows } = await query(`select p.*, c.name as category_name, c.slug as category_slug
     from public.products p
     left join public.categories c on c.id = p.category_id
     where p.slug = $1`, [slug]);
    const product = rows[0];
    if (!product)
        throw new ApiError(404, "Producto no encontrado");
    const attrs = await query("select * from public.product_attributes where product_id = $1 order by attribute_type", [product.id]);
    const opts = await query("select * from public.personalization_options where product_id = $1", [product.id]);
    res.json({ product: { ...product, attributes: attrs.rows, personalization: opts.rows } });
}
export async function createProduct(req, res) {
    const body = productSchema.parse(req.body);
    const { rows } = await query(`insert into public.products
       (name, slug, description, price, stock, low_stock_threshold, category_id,
        image_url, gallery, featured, active, is_customizable, materials)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     returning id`, [
        body.name,
        body.slug,
        body.description,
        body.price,
        body.stock,
        body.low_stock_threshold,
        body.category_id,
        body.image_url,
        JSON.stringify(body.gallery),
        body.featured,
        body.active,
        body.is_customizable,
        body.materials,
    ]);
    res.status(201).json({ id: rows[0].id });
}
export async function updateProduct(req, res) {
    const { id } = req.params;
    const body = productSchema.partial().parse(req.body);
    const fields = [];
    const params = [id];
    const fieldMap = {
        name: body.name,
        slug: body.slug,
        description: body.description,
        price: body.price,
        stock: body.stock,
        low_stock_threshold: body.low_stock_threshold,
        category_id: body.category_id,
        image_url: body.image_url,
        gallery: body.gallery ? JSON.stringify(body.gallery) : undefined,
        featured: body.featured,
        active: body.active,
        is_customizable: body.is_customizable,
        materials: body.materials,
    };
    for (const [col, val] of Object.entries(fieldMap)) {
        if (val !== undefined && val !== null) {
            params.push(val);
            fields.push(`${col} = $${params.length}`);
        }
    }
    if (!fields.length)
        throw new ApiError(400, "Sin campos para actualizar");
    const { rowCount } = await query(`update public.products set ${fields.join(", ")} where id = $1`, params);
    if (!rowCount)
        throw new ApiError(404, "Producto no encontrado");
    res.json({ ok: true });
}
export async function deleteProduct(req, res) {
    const { id } = req.params;
    const { rowCount } = await query("delete from public.products where id = $1", [id]);
    if (!rowCount)
        throw new ApiError(404, "Producto no encontrado");
    res.json({ ok: true });
}
export async function listCategories(_req, res) {
    const { rows } = await query("select * from public.categories order by display_order, name");
    res.json({ categories: rows });
}
