from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class APIModel(BaseModel):
    """JSON is camelCase so it matches frontend/src/types. Python stays snake_case."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
