const API_URL = (import.meta.env.VITE_PIECEWISE_API_URL as string | undefined) ?? "http://localhost:8000";

export async function fetchPiecewiseModel(
  prices: number[],
  maxModels: number,
  rsqTarget = 0.98,
  signal?: AbortSignal
): Promise<{ model: number[]; r2: number }> {
  const res = await fetch(`${API_URL}/piecewise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prices, max_models: maxModels, rsq_target: rsqTarget }),
    signal,
  });
  if (!res.ok) throw new Error(`Piecewise API error: ${res.status}`);
  return res.json();
}
