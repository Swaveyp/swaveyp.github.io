// HTTP API CorsConfiguration handles all Access-Control-* headers at the gateway level.
// Lambda only needs to set Content-Type. Adding Access-Control-Allow-Origin: * here
// would conflict with the gateway's per-origin allowlist.
export const corsHeaders = {
  'Content-Type': 'application/json'
};

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}
