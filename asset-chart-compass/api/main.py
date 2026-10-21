import math
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class PiecewiseRequest(BaseModel):
    prices: list[float]
    max_models: int = 10
    rsq_target: float = 0.98


def greedy_piecewise(cum_ret: list[float], rsq_target: float = 0.98, max_models: int = 10):
    n = len(cum_ret)
    if n < 2:
        return list(cum_ret), 1.0

    data = list(cum_ret)
    rsquare = 0.0
    nr_models = 0
    iteration = 1
    l = 0
    s_pos: list[int] = []
    e_pos: list[int] = []
    model = [0.0] * n
    all_models: list[list[float]] = []

    while rsquare < rsq_target and nr_models < max_models:
        if iteration == 1:
            nr_models = 1
            if data[n - 1] == data[0]:
                data[n - 1] += 1e-5
            for i in range(n):
                model[i] = data[0] + (data[n - 1] - data[0]) * (i / (n - 1))
            s_pos = [0]
            e_pos = [n - 1]
            l = max(range(n), key=lambda i: abs(data[i] - model[i]))
        else:
            nr_models += 1
            e_pos.append(l)
            s_pos.append(l)
            e_pos.sort()
            s_pos.sort()

            model = [float("nan")] * n
            for seg in range(len(s_pos)):
                start = s_pos[seg]
                end = e_pos[seg]
                if end > start:
                    if data[end] == data[start]:
                        data[end] += 1e-5
                    length = end - start
                    for j in range(length + 1):
                        model[start + j] = data[start] + (data[end] - data[start]) * (j / length)

            for i in range(n):
                if math.isnan(model[i]):
                    model[i] = data[i]

            l = max(range(n), key=lambda i: abs(data[i] - model[i]))

        mean = sum(data) / n
        ss_res = sum((data[i] - model[i]) ** 2 for i in range(n))
        ss_tot = sum((data[i] - mean) ** 2 for i in range(n))
        rsquare = 1 - ss_res / ss_tot if ss_tot != 0 else 0.0

        all_models.append(list(model))
        iteration += 1

    return (all_models[-1] if all_models else model), rsquare


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/piecewise")
def piecewise(req: PiecewiseRequest):
    model, r2 = greedy_piecewise(req.prices, req.rsq_target, req.max_models)
    return {"model": model, "r2": r2}
