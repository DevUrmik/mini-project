"""
Pydantic Schemas for Severity Prediction
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class SeverityPredictionRequest(BaseModel):
    temperature: float = Field(..., ge=-40.0, le=130.0, description="Ambient Temperature in Fahrenheit (-40 to 130)")
    humidity: float = Field(..., ge=0.0, le=100.0, description="Relative Humidity Percentage (0 to 100)")
    visibility: float = Field(..., ge=0.0, le=30.0, description="Visibility in miles (0 to 30)")
    wind_speed: float = Field(..., ge=0.0, le=120.0, description="Wind speed in mph (0 to 120)")
    weather_condition: str = Field("Fair", description="Recorded weather condition e.g. Fair, Rain, Fog, Clear")
    hour: int = Field(..., ge=0, le=23, description="Hour of the incident (0 to 23)")
    minute: int = Field(0, ge=0, le=59, description="Minute of the hour (0 to 59)")
    day_of_week: str = Field("Monday", description="Day of the week e.g. Monday, Friday, Saturday")
    junction: bool = Field(False, description="Whether incident occurred near a highway junction")
    crossing: bool = Field(False, description="Whether incident occurred near a pedestrian/road crossing")
    traffic_signal: bool = Field(False, description="Whether incident occurred near a traffic signal")
    stop: bool = Field(False, description="Whether incident occurred near a stop sign")
    state: Optional[str] = Field("CA", description="Optional US state abbreviation (e.g. CA, FL, TX, NY)")
    latitude: Optional[float] = Field(None, ge=24.0, le=50.0, description="Optional latitude")
    longitude: Optional[float] = Field(None, ge=-125.0, le=-66.0, description="Optional longitude")
    month: Optional[int] = Field(6, ge=1, le=12, description="Optional month (1 to 12)")
    amenity: bool = Field(False, description="Nearby point-of-interest/amenity")
    give_way: bool = Field(False, description="Yield / give-way sign")
    railway: bool = Field(False, description="Nearby railway crossing")
    station: bool = Field(False, description="Nearby transit station")

class ClassProbability(BaseModel):
    severity_class: int
    label: str
    probability: float
    percentage: float

class SeverityPredictionResponse(BaseModel):
    predicted_severity: int
    severity_category: str
    traffic_impact_description: str
    model_used: str
    class_probabilities: List[ClassProbability]
    high_impact_risk: Optional[Dict[str, Any]] = None
    input_summary: Dict[str, Any]
    disclaimer: str = (
        "This prediction estimates accident severity (Level 1–4: Minor to Critical) "
        "from historical incident patterns."
    )

