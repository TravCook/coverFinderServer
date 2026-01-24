from typing import Any, Optional
from pydantic import BaseModel
from .valueBetSettings import ValueBetRead
from .hyperParams import HyperParamRead

class SportRead(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    espnSport: Optional[str] = None
    league: Optional[str] = None
    startMonth: Optional[int] = None
    endMonth: Optional[int] = None
    multiYear: Optional[bool] = None
    statYear: Optional[int] = None
    prevStatYear: Optional[int] = None
    variance: Optional[float] = None
    reliabilityWeight: Optional[float] = None
    calibrationECE: Optional[float] = None
    threshold: Optional[float] = None
    hyperParameters: HyperParamRead
    valueBetSettings: list[ValueBetRead]
    value_threshold: Optional[float] = None
    value_map: Optional[list] = None


    class Config:
        from_attributes = True