import json
import logging
import uuid
from urllib.parse import urlparse

import paho.mqtt.client as mqtt

from ..printer.manager import PrinterManager

logger = logging.getLogger(__name__)

SUBSCRIBE_TOPIC = "niimbot/print"
RESULT_TOPIC_PREFIX = "niimbot/job"


class MQTTBridge:
    def __init__(self) -> None:
        self._client: mqtt.Client | None = None
        self._connected = False

    def start(self, broker_url: str) -> None:
        parsed = urlparse(broker_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 1883

        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message

        if parsed.username:
            self._client.username_pw_set(parsed.username, parsed.password)

        self._client.connect(host, port, keepalive=60)
        self._client.loop_start()
        logger.info("MQTT bridge starting, connecting to %s:%d", host, port)

    def stop(self) -> None:
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
        self._connected = False
        logger.info("MQTT bridge stopped")

    def _on_connect(
        self,
        client: mqtt.Client,
        userdata: object,
        flags: object,
        rc: int,
        properties: object = None,
    ) -> None:
        if rc == 0:
            self._connected = True
            client.subscribe(SUBSCRIBE_TOPIC)
            logger.info("MQTT connected, subscribed to %s", SUBSCRIBE_TOPIC)
        else:
            logger.error("MQTT connect failed with rc=%d", rc)

    def _on_message(
        self,
        client: mqtt.Client,
        userdata: object,
        msg: mqtt.MQTTMessage,
    ) -> None:
        try:
            payload = json.loads(msg.payload)
            png_b64 = payload.get("bitmap_png_b64")
            density = int(payload.get("density", 3))
            quantity = int(payload.get("quantity", 1))
            job_id = str(uuid.uuid4())

            manager = PrinterManager.get()
            success = True
            error: str | None = None
            try:
                manager.printer.print_png_b64(png_b64, density, quantity)
            except Exception as e:
                success = False
                error = str(e)
                logger.error("MQTT print job %s failed: %s", job_id, e)

            result = {"job_id": job_id, "success": success, "error": error}
            if self._client:
                self._client.publish(
                    f"{RESULT_TOPIC_PREFIX}/{job_id}", json.dumps(result)
                )
        except Exception as e:
            logger.error("MQTT message error: %s", e)


mqtt_bridge = MQTTBridge()
