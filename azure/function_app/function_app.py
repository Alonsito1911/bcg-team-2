"""Azure Function: procesa la telemetría de los sensores que llega al IoT Hub.

Por cada lote de mensajes aplica las reglas (reglas.py, copiado desde src/iot al
desplegar) y guarda el resultado en estado.json, en el contenedor $web del Storage,
donde lo lee el mapa en vivo.

Configuración (app settings, las crea azure/desplegar.sh):
  IOTHUB_EVENTS         cadena de conexión del endpoint compatible con Event Hubs del IoT Hub
  IOTHUB_EVENTHUB_NAME  nombre de ese endpoint
  WEB_STORAGE           cadena de conexión del Storage donde está el sitio web ($web)

Para la demo hay una sola instancia procesando; con varias en paralelo habría que
guardar el estado por bomba (por ejemplo en Table Storage) para no pisarse.
"""
import json
import logging
import os

import azure.functions as func
from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import BlobServiceClient, ContentSettings

import reglas

app = func.FunctionApp()
CONTENEDOR, BLOB = "$web", "estado.json"


def blob_estado():
    servicio = BlobServiceClient.from_connection_string(os.environ["WEB_STORAGE"])
    return servicio.get_blob_client(CONTENEDOR, BLOB)


@app.event_hub_message_trigger(arg_name="eventos", event_hub_name="%IOTHUB_EVENTHUB_NAME%",
                               connection="IOTHUB_EVENTS", cardinality=func.Cardinality.MANY)
def procesar_telemetria(eventos: list[func.EventHubEvent]):
    blob = blob_estado()
    try:
        estado = json.loads(blob.download_blob().readall())
    except ResourceNotFoundError:
        estado = reglas.nuevo_estado()

    for e in eventos:
        alerta = reglas.procesar(estado, json.loads(e.get_body().decode("utf-8")))
        if alerta and alerta["sms"]:
            # Aquí iría el envío real de SMS (por ejemplo, Africa's Talking o Twilio)
            logging.warning("SMS %s: %s", alerta["codigo"], alerta["mensaje"])

    blob.upload_blob(json.dumps(estado), overwrite=True,
                     content_settings=ContentSettings(content_type="application/json", cache_control="no-cache"))
    logging.info("Procesados %d eventos (total %d)", len(eventos), estado["eventos"])
