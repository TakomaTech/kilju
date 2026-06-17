import json as json_module
from typing import Any, Dict, List, Union


def stringify(obj: Any) -> str:
    return json_module.dumps(obj, indent=2)


def parse(text: str) -> Any:
    return json_module.loads(text)


def dumps(obj: Any, compact: bool = False) -> str:
    indent = None if compact else 2
    return json_module.dumps(obj, indent=indent)


def loads(text: str) -> Any:
    return json_module.loads(text)


def array(*items: Any) -> List[Any]:
    return list(items)


def object_(**kwargs: Any) -> Dict[str, Any]:
    return dict(kwargs)
