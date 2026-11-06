"""
Accident Hotspot Prediction and Road Safety Intelligence System
Development Fixture Generator

Generates a clearly labeled synthetic development sample strictly adhering to
the US Accidents (2016-2023) dataset schema by Sobhan Moosavi.

NOTICE:
This dataset fixture is strictly intended for local development, API verification,
and UI testing when the multi-gigabyte raw Kaggle dataset is not locally present.
It explicitly contains `Is_Synthetic_Dev_Fixture = True` on all records.
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def generate_dev_fixture(num_records: int = 35000, output_path: str = "data/samples/us_accidents_dev_fixture.csv"):
    np.random.seed(42)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print(f"[INFO] Generating {num_records} synthetic development records matching Moosavi US Accidents schema...")
    
    # Realistic accident hotspots in California (LA, SF Bay Area, San Diego, Sacramento)
    # Plus minor samples in FL (Miami/Orlando) and TX (Houston/Dallas)
    metro_hubs = [
        # Los Angeles Metro (I-5 / I-405 / I-10 corridor) - Weight: 45%
        {"city": "Los Angeles", "state": "CA", "county": "Los Angeles", "lat": 34.0522, "lng": -118.2437, "weight": 0.45, "std": 0.12},
        # San Francisco / San Jose Bay Area - Weight: 25%
        {"city": "San Francisco", "state": "CA", "county": "San Francisco", "lat": 37.7749, "lng": -122.4194, "weight": 0.15, "std": 0.08},
        {"city": "San Jose", "state": "CA", "county": "Santa Clara", "lat": 37.3382, "lng": -121.8863, "weight": 0.10, "std": 0.09},
        # San Diego (I-8 / I-15 / I-5 corridor) - Weight: 10%
        {"city": "San Diego", "state": "CA", "county": "San Diego", "lat": 32.7157, "lng": -117.1611, "weight": 0.10, "std": 0.08},
        # Sacramento Metro - Weight: 5%
        {"city": "Sacramento", "state": "CA", "county": "Sacramento", "lat": 38.5816, "lng": -121.4944, "weight": 0.05, "std": 0.07},
        # Miami, FL - Weight: 3%
        {"city": "Miami", "state": "FL", "county": "Miami-Dade", "lat": 25.7617, "lng": -80.1918, "weight": 0.03, "std": 0.08},
        # Houston, TX - Weight: 2%
        {"city": "Houston", "state": "TX", "county": "Harris", "lat": 29.7604, "lng": -95.3698, "weight": 0.02, "std": 0.10},
    ]
    
    weights = np.array([h["weight"] for h in metro_hubs], dtype=float)
    weights /= weights.sum()
    chosen_hubs = np.random.choice(len(metro_hubs), size=num_records, p=weights)
    
    lats = []
    lngs = []
    cities = []
    states = []
    counties = []
    
    for idx in chosen_hubs:
        hub = metro_hubs[idx]
        # Gaussian distribution around highway junctions
        lat = np.random.normal(hub["lat"], hub["std"])
        lng = np.random.normal(hub["lng"], hub["std"])
        lats.append(lat)
        lngs.append(lng)
        cities.append(hub["city"])
        states.append(hub["state"])
        counties.append(hub["county"])
        
    # Severity distribution in Moosavi dataset: Class 2 is dominant (~72%), Class 3 (~18%), Class 4 (~7%), Class 1 (~3%)
    severity_choices = [1, 2, 3, 4]
    severity_probs = [0.03, 0.72, 0.18, 0.07]
    severities = np.random.choice(severity_choices, size=num_records, p=severity_probs)
    
    # Timestamps between Jan 2022 and Dec 2023
    start_date = datetime(2022, 1, 1, 0, 0, 0)
    # Non-uniform hours reflecting commute rush hours (7-9 AM, 4-7 PM)
    hour_probs = np.array([
        0.015, 0.010, 0.008, 0.008, 0.012, 0.025, # 00:00 - 05:00
        0.055, 0.085, 0.095, 0.065, 0.045, 0.045, # 06:00 - 11:00
        0.050, 0.050, 0.055, 0.065, 0.085, 0.095, # 12:00 - 17:00
        0.075, 0.050, 0.035, 0.030, 0.025, 0.020  # 18:00 - 23:00
    ])
    hour_probs /= hour_probs.sum()
    
    random_days = np.random.randint(0, 700, size=num_records)
    random_hours = np.random.choice(24, size=num_records, p=hour_probs)
    random_mins = np.random.randint(0, 60, size=num_records)
    random_secs = np.random.randint(0, 60, size=num_records)
    
    start_times = []
    end_times = []
    for day, hr, mn, sc, sev in zip(random_days, random_hours, random_mins, random_secs, severities):
        st = start_date + timedelta(days=int(day), hours=int(hr), minutes=int(mn), seconds=int(sc))
        # Traffic delay duration correlates loosely with severity
        duration_minutes = int(np.random.gamma(shape=sev * 1.5, scale=15.0)) + 15
        et = st + timedelta(minutes=duration_minutes)
        start_times.append(st.strftime("%Y-%m-%d %H:%M:%S"))
        end_times.append(et.strftime("%Y-%m-%d %H:%M:%S"))
        
    # Weather attributes
    weather_conditions = [
        "Fair", "Clear", "Mostly Cloudy", "Partly Cloudy", "Overcast",
        "Light Rain", "Rain", "Fog", "Haze", "Heavy Rain", "Thunderstorm"
    ]
    weather_probs = [0.42, 0.22, 0.12, 0.08, 0.06, 0.04, 0.03, 0.015, 0.01, 0.004, 0.001]
    weathers = np.random.choice(weather_conditions, size=num_records, p=weather_probs)
    
    # Temperatures: mean 65 F, std 14 F
    temperatures = np.round(np.random.normal(65, 14, size=num_records), 1)
    # Humidity: mean 62%, bounded between 10% and 100%
    humidities = np.clip(np.round(np.random.normal(62, 18, size=num_records), 1), 5.0, 100.0)
    # Visibility: predominantly 10 miles with drop in rain/fog
    visibilities = []
    for w in weathers:
        if "Fog" in w:
            visibilities.append(np.round(np.random.uniform(0.5, 2.5), 1))
        elif "Heavy Rain" in w:
            visibilities.append(np.round(np.random.uniform(1.0, 4.0), 1))
        elif "Rain" in w:
            visibilities.append(np.round(np.random.uniform(3.0, 7.0), 1))
        else:
            visibilities.append(10.0 if np.random.rand() > 0.15 else np.round(np.random.uniform(7.0, 9.5), 1))
            
    # Wind speed: mean 7 mph, std 4 mph
    wind_speeds = np.clip(np.round(np.abs(np.random.normal(7.5, 4.5, size=num_records)), 1), 0.0, 50.0)
    
    # Road Infrastructure features (probabilities matching empirical US accident data)
    junctions = np.random.rand(num_records) < 0.14
    crossings = np.random.rand(num_records) < 0.09
    traffic_signals = np.random.rand(num_records) < 0.18
    stops = np.random.rand(num_records) < 0.03
    stations = np.random.rand(num_records) < 0.02
    traffic_calmings = np.random.rand(num_records) < 0.001
    
    # IDs formatted as A-XXXXXXX
    ids = [f"A-DEV-{i+1000000}" for i in range(num_records)]
    
    # Construct DataFrame adhering to official schema
    df = pd.DataFrame({
        "ID": ids,
        "Source": "DevFixture_Source2",
        "Severity": severities,
        "Start_Time": start_times,
        "End_Time": end_times,
        "Start_Lat": np.round(lats, 6),
        "Start_Lng": np.round(lngs, 6),
        "End_Lat": np.round(np.array(lats) + np.random.normal(0, 0.001, num_records), 6),
        "End_Lng": np.round(np.array(lngs) + np.random.normal(0, 0.001, num_records), 6),
        "Distance(mi)": np.round(np.random.exponential(scale=0.5, size=num_records), 3),
        "Description": "Accident report recorded in development environment fixture.",
        "Street": [f"US-{np.random.choice([101, 5, 405, 10, 80, 880])} Freeway" for _ in range(num_records)],
        "City": cities,
        "County": counties,
        "State": states,
        "Zipcode": [f"{np.random.randint(90001, 96162)}" for _ in range(num_records)],
        "Country": "US",
        "Timezone": "US/Pacific",
        "Airport_Code": [f"K{c[:3].upper()}" for c in cities],
        "Weather_Timestamp": start_times,
        "Temperature(F)": temperatures,
        "Wind_Chill(F)": temperatures - 2.0,
        "Humidity(%)": humidities,
        "Pressure(in)": np.round(np.random.normal(29.92, 0.25, size=num_records), 2),
        "Visibility(mi)": visibilities,
        "Wind_Direction": np.random.choice(["Calm", "NW", "W", "SW", "S", "SE", "E", "NE", "N"], size=num_records),
        "Wind_Speed(mph)": wind_speeds,
        "Precipitation(in)": np.where(np.isin(weathers, ["Light Rain", "Rain", "Heavy Rain", "Thunderstorm"]), np.round(np.random.uniform(0.01, 0.45, size=num_records), 2), 0.0),
        "Weather_Condition": weathers,
        "Amenity": np.random.rand(num_records) < 0.01,
        "Bump": np.random.rand(num_records) < 0.0005,
        "Crossing": crossings,
        "Give_Way": np.random.rand(num_records) < 0.002,
        "Junction": junctions,
        "No_Exit": np.random.rand(num_records) < 0.001,
        "Railway": np.random.rand(num_records) < 0.015,
        "Roundabout": np.random.rand(num_records) < 0.0005,
        "Station": stations,
        "Stop": stops,
        "Traffic_Calming": traffic_calmings,
        "Traffic_Signal": traffic_signals,
        "Turning_Loop": False,
        "Sunrise_Sunset": np.where((random_hours >= 6) & (random_hours <= 19), "Day", "Night"),
        "Civil_Twilight": np.where((random_hours >= 5) & (random_hours <= 20), "Day", "Night"),
        "Is_Synthetic_Dev_Fixture": True
    })
    
    df.to_csv(output_path, index=False)
    print(f"[SUCCESS] Saved development fixture with {len(df)} records to: {output_path}")
    print(f"[SUMMARY] Severity breakdown:\n{df['Severity'].value_counts(normalize=True).round(3)}")
    print(f"[SUMMARY] State breakdown:\n{df['State'].value_counts()}")
    return output_path

if __name__ == "__main__":
    generate_dev_fixture()
