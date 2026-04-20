from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    serial_port: str = "/dev/ttyUSB0"
    mqtt_url: str = ""
    data_dir: str = "./data"

    class Config:
        env_file = ".env"


settings = Settings()
