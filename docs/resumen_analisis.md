# Bombas de agua en Kiryandongo (Uganda): resumen del análisis

Hackathon humanitario · BCG Team 2 · octubre 2026

> **Leyenda:** ✅ dato verificado con fuente · ⚠️ supuesto u orden de magnitud no verificado.
> Datos de bombas: WPDx (censo de febrero 2022). Código y datos: ver [`README.md`](../README.md).

---

## 1. En una frase

En Kiryandongo, la ayuda humanitaria llega al asentamiento de refugiados, pero las comunidades vecinas absorben la presión con bombas manuales que ya no dan abasto y que nadie monitorea. La herramienta dice **qué bombas reparar, reforzar o monitorear primero**, según cuántas personas afecta cada una.

---

## 2. Por qué Kiryandongo

Comparamos varias zonas de Uganda usando WPDx (Water Point Data Exchange):

| Zona | Datos recientes | Problema principal | Veredicto |
|---|---|---|---|
| **Kiryandongo** (Bunyoro) | 847 puntos, censo 2022, consistentes | 42% de bombas sobreusadas, 112 rotas, refugiados | ✅ **Piloto** |
| Gulu (Acholi) | 690 puntos 2022, solo 2 subcondados | Región más pobre, pero las bombas rotas tienen alternativas cerca (0 críticas) | Contraste para el pitch |
| Mayuge (Busoga) | Datos 2025, pero 70% con estado contradictorio y son grifos | Calidad del agua (lago Victoria) | Etapa 2 (calidad) |
| Karamoja | Todo 2010–2015 y contradictorio | La región más pobre y seca | Argumento: "donde más falta, menos datos hay" |
| Buliisa | 259 puntos, todo 2010–2014 | Pocos pozos por km² | Sin datos útiles |

**Comparación Gulu vs. Kiryandongo** (datos 2016+):

| | Gulu | Kiryandongo |
|---|---|---|
| Puntos | 690 | 847 |
| Rotas | 87 (13%) | 112 (13%) |
| Rotas sin alternativa (criticidad > 80%) | 0 | 6 |
| Funcionan pero sobreusadas | 58 (12%) | **270 (42%)** |
| Presión típica (uso vs. capacidad) | 25% | **90%** |
| Refugiados | ❌ | ✅ |

---

## 3. Qué pasa en Kiryandongo

### Contexto ✅
- Asentamiento de refugiados de **~165.000 personas**, de Sudán del Sur y, desde 2023, de Sudán. ([UNICEF](https://www.unicef.org/uganda/press-releases/new-solar-hybrid-water-systems-bring-relief-165000-refugees-kiryandongo-settlement))
- El agua dentro del asentamiento bajó de **16 a 9 litros por persona al día** entre 2023 y 2024. El mínimo humanitario es 15–20 L. ([UNICEF](https://www.unicef.org/uganda/stories/eu-humanitarian-aidunicef-water-systems-end-long-treks-kiryandongo-refugees))
- En 2025, UNICEF, la UE y ACNUR construyeron **pozos motorizados y sistemas solar-diésel con 22 grifos públicos** dentro del asentamiento. Esos sistemas no están en el censo WPDx.

### Fuera del asentamiento (censo 2022)
- **~217.000 personas** dependen de bombas manuales con capacidad para **~170.000**.
- **46% de las bombas que funcionan está sobreusada**; la bomba típica está al 94% de su capacidad.
- **112 bombas rotas**; 49 de ellas dejaban sin agua a 300 personas o más cada una.

| Subcondado | Uso vs. capacidad |
|---|---|
| **Bweyale Town Council** (pegado al asentamiento) | **189%** |
| **Kiryandongo** | **158%** |
| Kigumba Town Council | 125% |
| Kigumba | 113% |
| Mutunda | 103% |
| Masindi Port | 60% |

### Dentro del asentamiento (estimación en litros, 2024)

| Estándar | Personas abastecidas | Sin abastecer |
|---|---|---|
| 15 L/día (Sphere) | ~99.000 | **~66.000** |
| 20 L/día (ACNUR) | ~74.000 | **~91.000** |

Cálculo: 165.000 personas × 9 L = ~1,5 millones de litros al día disponibles.

### Lluvia ✅ (Open-Meteo, ERA5)
- **Estación seca muy marcada en diciembre–febrero:** 12–44 mm al mes, contra 100–180 mm el resto del año.
- **2021 y 2022 fueron años secos**, y el censo es de **febrero de 2022, en plena estación seca**.
- Dentro del distrito, la lluvia varía ~20% entre zonas.

### Tipo de pozo
- **837 de 847 puntos son pozos con bomba manual.** La gente camina al pozo, hace fila, bombea y carga bidones de 20 L; mayormente lo hacen mujeres y niñas.
- ~325 son pozos profundos y ~500 son poco profundos. **Los poco profundos se secan y se contaminan más.**

---

## 4. Modelo de prioridad (v1, por reglas)

### Reglas

| Nivel | Regla | Bombas | Personas afectadas |
|---|---|---|---|
| 🔴 **Crítico** | Rota con ≥ 300 usuarios, o funciona a ≥ 200% de su capacidad | **91** | **41.295** |
| 🟠 **Alto** | Rota con menos usuarios, o sobreusada (100–200%) | 284 | 37.034 |
| 🟣 **Revisar** | Abandonada, contradictoria o con dato atípico | 104 | — |
| 🟢 **Bien** | Funciona dentro de su capacidad | 368 | — |

- **Personas afectadas:** si está rota, sus usuarios; si está sobreusada, las personas por sobre la capacidad (300).
- **Puntaje** = personas afectadas × factor de estación seca (1,0–1,2).
- **Dónde están las críticas:** subcondado Kiryandongo 38, Bweyale 22, Mutunda 12, Kigumba 11, Kigumba TC 8.

### Variables usadas
- **WPDx:** `status_id`, `status_clean`, `served_population`, `pressure`, `usage_cap`, `report_date`, coordenadas, distrito y subcondado.
- **Open-Meteo:** lluvia diaria 2015–2024 por celda de ~11 km.

### Por qué reglas y no machine learning
- Es transparente: el usuario entiende por qué una bomba quedó primera.
- Hay una sola foto (2022), sin historia para entrenar.
- Los umbrales se ajustan cambiando un número.

---

## 5. Modelos predictivos (siguiente paso)

### a) Probabilidad de falla
Datos para entrenar: ~98.000 puntos de WPDx Uganda con estado funciona/rota.

| Variable | En Kiryandongo | Por qué |
|---|---|---|
| Edad de la bomba | 91% | Las viejas fallan más |
| Sobreuso (`pressure`) | 90% | Desgaste |
| Modelo de bomba | 99% | Distinta confiabilidad |
| Tipo de pozo | 100% | Los poco profundos se secan |
| Tipo de gestión | 68% | Una gestión activa repara antes |
| Distancia a pueblos y caminos | 100% | Acceso a repuestos |
| Lluvia | 100% | Años secos |

### b) Riesgo de contaminación
Datos para entrenar: **1.506 puntos de WPDx Uganda con resultado de E. coli** (54% positivos). Kiryandongo tiene 0.

| Tipo de fuente | Con E. coli |
|---|---|
| Vertiente protegida | 97% |
| Pozo poco profundo | 89% |
| Pozo profundo | 61% |
| Tubería | 12% |

**Variables clave:** tipo de fuente, lluvia de los 7–30 días previos, estación, población, distancia a pueblos, edad del pozo y cercanía al asentamiento.

⚠️ "Presencia" probablemente significa cualquier detección, y cada ONG mide distinto. Sirve como **riesgo relativo**. Hay que validar dejando distritos afuera.

**Para qué sirve:** testear menos y mejor, actuar antes de un brote, priorizar reparaciones y decidir si perforar un pozo profundo.

---

## 6. Agua contaminada y salud

| Dato | Cifra | Fuente |
|---|---|---|
| Muertes al año por diarrea causada por agua para tomar contaminada (todas las edades) | **505.000** | ✅ [OMS, 2023](https://www.who.int/news-room/fact-sheets/detail/drinking-water) |
| Niños < 5 años muertos por diarrea vinculada a agua, saneamiento e higiene | **~273.000** (rango 252.000–296.000) | ✅ [The Lancet, 2023](https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(23)00458-0/fulltext) |
| Muertes totales por agua, saneamiento e higiene | ~1,4 millones (395.000 niños < 5) | ✅ [OMS, 2023](https://www.who.int/news/item/28-06-2023-improving-access-to-water--sanitation-and-hygiene-can-save-1.4-million-lives-per-year--says-new-who-report) |
| Hogares de Bunyoro con agua de tomar con contaminación fecal | **92,4%** (nacional 88,9%) | ✅ [UDHS 2022](https://www.ubos.org/wp-content/uploads/2024/03/UDHS-2022-Fact-Sheet.pdf) |
| Mortalidad < 5 años en Uganda | 52 por 1.000 nacidos vivos (refugiados: 45) | ✅ UDHS 2022 |
| Niños en conflictos prolongados | 3 veces más probabilidad de morir por enfermedades del agua que por violencia | ✅ [UNICEF, 2019](https://www.unicef.org/press-releases/children-living-protracted-conflicts-are-three-times-more-likely-die-water-related) |

⚠️ Los 395.000 niños **no** son parte de los 505.000: miden cosas distintas (edad, causa y enfermedad).

**Casos documentados:**
- **Kyangwali (Kikuube), 2018:** cólera con **2.122 casos y 44 muertes**, por un arroyo usado para defecar. La mayoría murió en la comunidad, de noche; el brote se confirmó ~12 días después del primer caso. ([estudio](https://doaj.org/article/a37f7276881e4aef97f48853c7d0a0cc)) En 2022, Kyangwali tenía **36% de bombas rotas**.
- **Kiryandongo:** brote de cólera en Panyadoli con 2 muertes (fecha no confirmada). Un estudio de 2011 encontró E. coli en el 15% de los pozos excavados a mano de Bweyale. Hay 1 letrina cada 80 personas, cuando lo recomendado es 1 cada 50.
- **No hay datos públicos de muertes infantiles por agua en Kiryandongo.**

---

## 7. Bombas y sensores

### Bombas instaladas en Kiryandongo

| Modelo | Total | Entre las 91 críticas |
|---|---|---|
| **India Mark II** | 488 (58%) | **51** |
| Consallen | 148 (17%) | 16 |
| Afridev | 24 (3%) | 4 |
| Sin modelo | 177 (21%) | 20 |

### Sensores que existen (ninguno instalado en Kiryandongo)

| Sensor | Bomba | Estado | Envía por | Costo |
|---|---|---|---|---|
| **India Mark II sensor** (charity: water) | India Mark II | ✅ En uso en Uganda y otros 3 países (339 sensores a fines de 2022) | Celular 2G/3G | ✅ **~250 USD con 10 años de datos** ([u-blox](https://www.u-blox.com/en/blogs/u-blox-charity-water-iot-clean-drinking-water)) |
| AFD-1 Water Flow Sensor (charity: water) | Afridev e India Mark II | Existe | Celular | ⚠️ |
| Smart Handpump / Waterpoint Data Transmitter (Oxford) | Bombas manuales (acelerómetro en la manilla) | Pilotos en Kenia: **reparación de 27 a 3 días** | Celular | ⚠️ |
| Prototipo Arup / Fields of Life | Bombas manuales | 10 pozos en Kumi, Uganda; avisa por SMS al mecánico | Celular | ⚠️ |

⚠️ Riesgo: usa 2G/3G; hay que confirmar con MTN y Airtel que esas redes siguen activas.

### Sensores de calidad del agua

| Tipo | Tiempo | Costo ⚠️ | Uso |
|---|---|---|---|
| Kit de bolsa (Aquagenx CBT) | 20–48 h | ~10 USD por prueba | ⭐ Terreno, sin laboratorio |
| Colilert (IDEXX) | 18–24 h | ~5–10 USD + incubadora | Laboratorio |
| Filtración por membrana (DelAgua) | 18–24 h | Kit de miles de USD | ONG de agua |
| Tira de H₂S | 24–72 h | ~1 USD | Barata, menos precisa |
| Fluorescencia (TLF) | Segundos | Cientos a miles de USD | Indicador inmediato, no confirma |
| Detector automático (ColiMinder, Fluidion) | 15 min – 15 h | Miles a decenas de miles | Sistemas grandes |
| Cloro residual, turbidez | Continuo | Bajo a medio | Grifos del asentamiento |

---

## 8. Conectividad: celular y LoRa

### Antenas conocidas (OpenStreetMap, muy incompleto)
- **Dentro del distrito, solo 1 sitio:** Katulikire (2,02° N, 32,14° E), con 2 torres, cerca del asentamiento.
- Otras 3 están en distritos vecinos (Masindi, Nakasongola, Oyam).
- Para tener las reales hace falta [OpenCelliD](https://opencellid.org) (clave gratuita).

### LoRa
- **Una antena celular no da LoRa.** Hay que instalar un gateway LoRa; la torre solo sirve como sitio, porque ya tiene altura, energía e internet.
- **Alcance rural típico: 5–10 km** ⚠️. Supuesto prudente: 7 km. Se confirma con una prueba de campo de un día.

| Alcance | Críticas cubiertas solo con la torre | + 3 gateways nuevos | + 6 gateways nuevos |
|---|---|---|---|
| 5 km | 23/91 | 62/91 | 79/91 |
| **7 km** | 40/91 | 76/91 | **86/91** |
| 10 km | 54/91 | 89/91 | 91/91 |
| 15 km | 62/91 | 91/91 | 91/91 |

---

## 9. Presupuesto para las 91 bombas críticas

### Situación
- **49 rotas** → 21.758 personas sin agua.
- **42 sobreusadas** → 19.537 personas sobre la capacidad (harían falta ~65 pozos nuevos).

### Sensores: celular vs. LoRa

| Opción | Detalle | Costo |
|---|---|---|
| **Celular** | 51 India Mark × 250 ✅ + 4 Afridev × ~250 ⚠️ + 36 genéricos × 100–300 ⚠️ | **~17–25 mil USD** |
| LoRa, 7 km | 86 sensores × ~100 + 1 gateway en torre (~750) + 6 nuevos × ~2.000 + 5 celulares | ~22,6 mil USD (rango 12–33 mil) ⚠️ |
| LoRa, 10 km | 89 sensores × ~100 + 1 gateway en torre (~750) + 3 nuevos × ~2.000 + 2 celulares | ~16 mil USD (rango 8,5–24 mil) ⚠️ |

**LoRa no incluye el costo de desarrollar un sensor**, porque no existe uno listo para bombas manuales.

### Escenarios

| Escenario | Costo | Resultado |
|---|---|---|
| A. Solo sensores | ~17–25 mil USD | Monitoreo de las 91 |
| **B. Sensores + reparar las 49 rotas** (reparación menor ~100–500 USD ⚠️) | **~22–50 mil USD** | **~22.000 personas recuperan el agua (~1–2 USD por persona)** |
| C. B + pozos nuevos (~8–15 mil USD cada uno ⚠️) | ~0,5–1 millón USD | Además, se resuelve el sobreuso de 19.537 personas |

### Al escalar a las 847 bombas
- Celular: ~212 mil USD.
- LoRa: ~109 mil USD ⚠️ (**~50% menos**).

**Recomendación:** celular para el piloto (probado, mismo costo) y LoRa al escalar.

---

## 10. Alertas a la comunidad

### Acceso a celular ✅

| Grupo | Con celular |
|---|---|
| Hogares refugiados en Kiryandongo | **74%** (2018) |
| Refugiados en Uganda | 71%; 53% de ellos con teléfono básico |
| Adultos en Uganda | 72% (hombres 80%, mujeres 64%) |
| Cobertura de red en asentamientos | 99,6% con 2G |

**Las mujeres, que acarrean el agua, tienen menos acceso.** La mayoría de los teléfonos son básicos: sirven SMS y voz, no apps.

### Cómo avisar que un pozo está contaminado
1. **SMS a los responsables:** cuidador de la bomba, promotor de salud (VHT), oficina distrital de agua y centro de salud.
2. **Llamada de voz grabada** en idioma local a los hogares registrados cerca del pozo.
3. **Bandera o letrero rojo en la bomba:** "NO TOMAR, hervir o clorar". Llega a quien no tiene celular.
4. **Promotor de salud casa por casa**, radio comunitaria e iglesias o mezquitas.

### Cómo informa una persona el resultado de un test (lo más simple)
- Cada pozo tiene un **código pintado** (por ejemplo, `KIR-0452`).
- Se manda un **SMS**: `KIR-0452 SI` (contaminado) o `KIR-0452 NO` (limpio).
- El sistema responde "Recibido" y actualiza el mapa y las alertas.
- Ya funcionó un modelo similar en la zona: **M4W en Masindi** (reporte de fallas por SMS, mecánico en 48 h).

---

## 11. Arquitectura en Azure (propuesta para la demo)

```
Sensor simulado (Python) ──► Azure IoT Hub ──► Azure Function (reglas) ──► Azure Storage (historial)
SMS de la comunidad ──► webhook ────────────────┘          │
                                                           ├──► Alerta por SMS (mecánico, VHT)
                                                           └──► estado.json ──► Mapa web
```

| Regla en la Function | Señal | Acción |
|---|---|---|
| Posible falla | 0 bombeos en el día | SMS al mecánico; el pozo pasa a rojo |
| Sobreuso | Litros por día muy sobre la capacidad | Sube de prioridad |
| Riesgo de contaminación | La turbidez sube tras lluvia fuerte | SMS al promotor de salud: hacer test |
| Sensor caído | Sin mensajes en 24 h | Aviso técnico |

- **IoT Hub gratis:** ~8.000 mensajes al día ⚠️. 91 bombas cada hora son ~2.200 mensajes, así que entran.
- **SMS en Uganda:** proveedor local (Africa's Talking) o Twilio ⚠️.
- **Simulación propuesta:** las 91 críticas, con uso diurno, una bomba que falla, una sobreusada y un pico de turbidez tras la lluvia.

---

## 12. Limitaciones

- **Los datos de bombas son de febrero 2022.** No hay datos más recientes para Kiryandongo.
- **WPDx subcuenta a los refugiados** (~16.000 usuarios dentro del asentamiento, contra ~165.000 reales).
- **El límite del asentamiento en OpenStreetMap** probablemente está incompleto.
- **Los umbrales del modelo no están calibrados.** Sphere usa 250 personas por bomba; nosotros, 300 (WPDx).
- **Las antenas de OpenStreetMap están muy incompletas.**
- **No hay datos de calidad del agua en Kiryandongo.**
- **Los costos marcados ⚠️ son órdenes de magnitud**, salvo el sensor de charity: water.

---

## 13. Próximos pasos

1. **Recomendador de presupuesto** en el mapa: un slider de USD que muestre las bombas a reparar y monitorear y las personas que recuperan el agua.
2. **Verificar costos** de reparación, pozos nuevos, sensores y gateways LoRa en Uganda.
3. **Modelos de falla y de contaminación** con datos de WPDx Uganda.
4. **Antenas reales** con OpenCelliD.
5. **Simulador IoT + Azure** para la demo en vivo.

---

## 14. Frases para el pitch

- *"En Kiryandongo, la ayuda llega al asentamiento, pero las comunidades vecinas absorben a los refugiados con las mismas bombas de siempre."*
- *"En Bweyale, cada bomba atiende al doble de gente de la que puede."*
- *"El último censo de bombas es de 2022. Hoy nadie sabe cuáles de las 847 funcionan."*
- *"Con ~35 mil USD monitoreamos las 91 bombas críticas y reparamos las 49 rotas: ~22.000 personas recuperan el agua por menos de 2 USD por persona."*
- *"La tecnología ya existe y se probó en Uganda: falta decidir dónde ponerla. Eso hace nuestra herramienta."*
- *"El agua contaminada causa ~505.000 muertes al año por diarrea (OMS). En 2018, en Kyangwali, 44 personas murieron de cólera por tomar agua de un arroyo."*

---

## Fuentes de datos

- **WPDx+** (CC BY 4.0): https://www.waterpointdata.org
- **OpenStreetMap** (ODbL): Nominatim y Overpass
- **Open-Meteo / ERA5** (CC BY 4.0): https://open-meteo.com
- **UNICEF Uganda**, **OMS**, **UDHS 2022 (UBOS)**, **Sphere**, **charity: water / u-blox**, **Universidad de Oxford**: enlazados en cada sección.
