"""
Pydantic Schemas for Road Safety Analytics
"""

from typing import List, Dict, Any
from pydantic import BaseModel

class HourlyTrend(BaseModel):
    hour: int
    count: int
    percentage: float
    is_rush_hour: bool

class WeekdayTrend(BaseModel):
    day: str
    count: int
    percentage: float
    is_weekend: bool

class TimeAnalyticsResponse(BaseModel):
    hourly: List[HourlyTrend]
    daily: List[WeekdayTrend]
    rush_hour_breakdown: Dict[str, Any]

class WeatherConditionStat(BaseModel):
    condition: str
    accident_count: int
    average_severity: float
    percentage: float

class TemperatureBinStat(BaseModel):
    temp_range: str
    accident_count: int
    average_severity: float

class WeatherAnalyticsResponse(BaseModel):
    weather_conditions: List[WeatherConditionStat]
    temperature_distribution: List[TemperatureBinStat]
    insights: List[str]

class InfrastructureFeatureStat(BaseModel):
    feature: str
    present_count: int
    absent_count: int
    present_avg_severity: float
    absent_avg_severity: float
    present_percentage: float

class InfrastructureAnalyticsResponse(BaseModel):
    features: List[InfrastructureFeatureStat]
    insights: List[str]

