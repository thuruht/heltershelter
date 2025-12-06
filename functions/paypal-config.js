export async function onRequest(context) {
  const clientId = context.env.PAYPAL_CLIENT_ID;

  if (!clientId) {
    return new Response(JSON.stringify({ error: "PAYPAL_CLIENT_ID not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ clientId }), {
    headers: { "Content-Type": "application/json" },
  });
}
