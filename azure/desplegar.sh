#!/usr/bin/env bash
# Crea los recursos de Azure y despliega la demo de monitoreo en vivo.
#
# Uso (desde la raíz del repo, con sesión iniciada: az login):
#   bash azure/desplegar.sh
#
# Crea: grupo de recursos, IoT Hub (F1 gratis), dispositivo "gateway-kiryandongo",
# Storage con sitio web estático (mapa en vivo) y Function App en Python.
# Guarda nombres y la cadena de conexión del dispositivo en .env (no se sube al repo).
# Para borrar todo:  az group delete -n <RG> --yes
set -euo pipefail
cd "$(dirname "$0")/.."

AZ="${AZ:-az}"
command -v "$AZ" >/dev/null 2>&1 || AZ=".venv/Scripts/az"
PY="${PY:-$(command -v python3 || command -v python)}"
[ -f .env ] && set -a && . ./.env && set +a

RG="${RG:-rg-agua-kiryandongo}"
LOC="${LOC:-eastus}"
HUB="${HUB:-iot-agua-kiry-$RANDOM}"
HUB_SKU="${HUB_SKU:-F1}"          # solo un IoT Hub F1 por suscripción; si ya hay uno, usar S1
ST="${ST:-staguakiry$RANDOM}"
FN="${FN:-fn-agua-kiry-$RANDOM}"
DEVICE="gateway-kiryandongo"

guardar_env() {
  cat > .env <<EOF
RG=$RG
LOC=$LOC
HUB=$HUB
HUB_SKU=$HUB_SKU
ST=$ST
FN=$FN
IOTHUB_DEVICE_CONNECTION_STRING="${IOTHUB_DEVICE_CONNECTION_STRING:-}"
EOF
}
guardar_env

echo "== 1/6 Grupo de recursos $RG"
# En suscripciones compartidas (hackathon) suele haber permiso solo dentro de un grupo
# ya creado: si existe, se usa tal cual y en su misma región.
if RG_LOC=$("$AZ" group show -n "$RG" --query location -o tsv 2>/dev/null); then
  LOC="$RG_LOC"
  echo "   usando el grupo existente ($LOC)"
else
  "$AZ" group create -n "$RG" -l "$LOC" -o none
fi
guardar_env

echo "== 2/6 IoT Hub $HUB ($HUB_SKU) y dispositivo $DEVICE"
"$AZ" extension add --name azure-iot --upgrade -y -o none 2>/dev/null || true
if ! "$AZ" iot hub show -n "$HUB" -g "$RG" -o none 2>/dev/null; then
  "$AZ" iot hub create -n "$HUB" -g "$RG" -l "$LOC" --sku "$HUB_SKU" --partition-count 2 -o none
fi
"$AZ" iot hub device-identity show --hub-name "$HUB" -d "$DEVICE" -o none 2>/dev/null \
  || "$AZ" iot hub device-identity create --hub-name "$HUB" -d "$DEVICE" -o none
IOTHUB_DEVICE_CONNECTION_STRING=$("$AZ" iot hub device-identity connection-string show \
  --hub-name "$HUB" -d "$DEVICE" --query connectionString -o tsv)
guardar_env

echo "== 3/6 Storage $ST con sitio web estático"
"$AZ" storage account show -n "$ST" -g "$RG" -o none 2>/dev/null \
  || "$AZ" storage account create -n "$ST" -g "$RG" -l "$LOC" --sku Standard_LRS --allow-blob-public-access false -o none
"$AZ" storage blob service-properties update --account-name "$ST" --auth-mode login \
  --static-website --index-document index.html -o none 2>/dev/null \
  || "$AZ" storage blob service-properties update --account-name "$ST" \
       --static-website --index-document index.html -o none

echo "== 4/6 Function App $FN"
if ! "$AZ" functionapp show -n "$FN" -g "$RG" -o none 2>/dev/null; then
  "$AZ" functionapp create -n "$FN" -g "$RG" --storage-account "$ST" \
    --consumption-plan-location "$LOC" --runtime python --runtime-version 3.11 \
    --functions-version 4 --os-type Linux -o none \
  || "$AZ" functionapp create -n "$FN" -g "$RG" --storage-account "$ST" \
    --flexconsumption-location "$LOC" --runtime python --runtime-version 3.11 -o none
fi
EVENTS_CONN=$("$AZ" iot hub connection-string show -n "$HUB" -g "$RG" --default-eventhub --query connectionString -o tsv)
EVENTS_NAME=$("$AZ" iot hub show -n "$HUB" -g "$RG" --query properties.eventHubEndpoints.events.path -o tsv)
WEB_CONN=$("$AZ" storage account show-connection-string -n "$ST" -g "$RG" --query connectionString -o tsv)
"$AZ" functionapp config appsettings set -n "$FN" -g "$RG" -o none --settings \
  IOTHUB_EVENTS="$EVENTS_CONN" IOTHUB_EVENTHUB_NAME="$EVENTS_NAME" WEB_STORAGE="$WEB_CONN"   SCM_DO_BUILD_DURING_DEPLOYMENT=true

echo "== 5/6 Código de la Function"
TMP=$(mktemp -d)
cp azure/function_app/* "$TMP/"
cp src/iot/reglas.py "$TMP/"
"$PY" -c "import shutil,sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2])" "$TMP/../fn_agua" "$TMP"
"$AZ" functionapp deployment source config-zip -n "$FN" -g "$RG" --src "$TMP/../fn_agua.zip" --build-remote true -o none

echo "== 6/6 Mapa en vivo"
WEB="$TMP/web"
"$PY" src/iot/preparar_web.py "$WEB"
"$PY" -c "import json,sys; sys.path.insert(0,'src'); from iot import reglas; open(sys.argv[1],'w').write(json.dumps(reglas.nuevo_estado()))" "$WEB/estado.json"
"$AZ" storage blob upload-batch -d '$web' -s "$WEB" --account-name "$ST" --overwrite -o none
URL=$("$AZ" storage account show -n "$ST" -g "$RG" --query primaryEndpoints.web -o tsv)

echo
echo "Listo."
echo "  Mapa en vivo:  $URL"
echo "  Simular:       python src/iot/simulador.py --azure"
echo "  Borrar todo:   $AZ group delete -n $RG --yes"
