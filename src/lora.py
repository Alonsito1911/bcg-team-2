"""Escenario LoRaWAN: gateways en torres existentes + gateways nuevos propuestos.

Un gateway LoRa en altura cubre del orden de 5-15 km en zona rural plana.
Se parte de las torres conocidas (pueden alojar un gateway: tienen altura,
energía y conexión) y se proponen gateways nuevos con un algoritmo greedy:
cada nuevo gateway se ubica donde cubre más personas afectadas en bombas
críticas todavía sin cobertura.
"""
import math

RADIO_LORA_KM = 10
N_GATEWAYS_NUEVOS = 3
DUPLICADO_KM = 0.2   # torres a menos de esto se consideran el mismo sitio


def distancia_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a))


def cubre(sitio, p, radio=RADIO_LORA_KM):
    return distancia_km(sitio["lat"], sitio["lon"], float(p["lat"]), float(p["lon"])) <= radio


def sin_duplicados(torres):
    unicas = []
    for t in torres:
        if all(distancia_km(t["lat"], t["lon"], u["lat"], u["lon"]) > DUPLICADO_KM for u in unicas):
            unicas.append(t)
    return unicas


def escenario(puntos, torres, n_nuevos=N_GATEWAYS_NUEVOS, radio=RADIO_LORA_KM):
    """puntos: filas de prioridad (lat, lon, nivel, personas_afectadas)."""
    existentes = sin_duplicados(torres)
    criticas = [p for p in puntos if p["nivel"] == "Crítico"]
    pendientes = [p for p in criticas if not any(cubre(t, p, radio) for t in existentes)]

    nuevos = []
    for _ in range(n_nuevos):
        mejor, mejor_valor = None, 0
        for cand in criticas:
            sitio = {"lat": float(cand["lat"]), "lon": float(cand["lon"])}
            valor = sum(int(p["personas_afectadas"]) for p in pendientes if cubre(sitio, p, radio))
            if valor > mejor_valor:
                mejor, mejor_valor = sitio, valor
        if not mejor:
            break
        cubiertas = [p for p in pendientes if cubre(mejor, p, radio)]
        mejor.update(criticas=len(cubiertas), personas=mejor_valor)
        nuevos.append(mejor)
        pendientes = [p for p in pendientes if p not in cubiertas]

    sitios = existentes + nuevos
    resumen = {
        "radio_km": radio,
        "bombas_cubiertas": sum(any(cubre(s, p, radio) for s in sitios) for p in puntos),
        "criticas_total": len(criticas),
        "criticas_con_torres": sum(any(cubre(t, p, radio) for t in existentes) for p in criticas),
        "criticas_con_todo": len(criticas) - len(pendientes),
    }
    return existentes, nuevos, resumen
