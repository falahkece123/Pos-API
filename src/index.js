const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS Preflight Request
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. READ ALL PRODUCTS (GET /api/products)
      if (path === "/api/products" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM products").all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. CREATE PRODUCT (POST /api/products)
      if (path === "/api/products" && method === "POST") {
        const { name, price, category } = await request.json();
        if (!name || !price || !category) throw new Error("Missing fields");

        const info = await env.DB.prepare(
          "INSERT INTO products (name, price, category) VALUES (?, ?, ?)"
        ).bind(name, price, category).run();

        return new Response(JSON.stringify({ success: true, id: info.meta.last_row_id }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. UPDATE PRODUCT (PUT /api/products/:id)
      if (path.startsWith("/api/products/") && method === "PUT") {
        const id = path.split("/").pop();
        const { name, price, category, status } = await request.json();
        
        await env.DB.prepare(
          "UPDATE products SET name = ?, price = ?, category = ?, status = ? WHERE id = ?"
        ).bind(name, price, category, status, id).run();

        return new Response(JSON.stringify({ success: true, message: `Product ${id} updated` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 4. DELETE PRODUCT (DELETE /api/products/:id)
      if (path.startsWith("/api/products/") && method === "DELETE") {
        const id = path.split("/").pop();
        await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();

        return new Response(JSON.stringify({ success: true, message: `Product ${id} deleted` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 404 Route Not Found
      return new Response("Not Found", { status: 404, headers: corsHeaders });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
};
