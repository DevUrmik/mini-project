import threading
import time
import httpx
import uvicorn
from server.app.main import app

def run_server():
    uvicorn.run(app, host='127.0.0.1', port=8000, log_level='error')

if __name__ == '__main__':
    thread = threading.Thread(target=run_server, daemon=True)
    thread.start()
    time.sleep(2)

    client = httpx.Client(base_url='http://127.0.0.1:8000')

    endpoints = [
        '/api/health',
        '/api/dashboard/summary',
        '/api/accidents?limit=5',
        '/api/hotspots?k=10',
        '/api/hotspots/dbscan',
        '/api/analytics/time',
        '/api/analytics/weather',
        '/api/models/metrics'
    ]

    print('[SERVER TEST] Probing GET endpoints:')
    for ep in endpoints:
        r = client.get(ep)
        print(f'  {ep:32s} -> Status {r.status_code}')
        assert r.status_code == 200

    # Test POST inference
    post_payload = {
        'temperature': 55.0,
        'humidity': 80.0,
        'visibility': 3.0,
        'wind_speed': 15.0,
        'weather_condition': 'Rain',
        'hour': 18,
        'day_of_week': 'Friday',
        'junction': True,
        'crossing': False,
        'traffic_signal': True,
        'stop': False
    }
    pred_r = client.post('/api/predict/severity', json=post_payload)
    print(f'  /api/predict/severity (POST)     -> Status {pred_r.status_code}')
    assert pred_r.status_code == 200
    pred_json = pred_r.json()
    print(f'  Prediction Output: Severity {pred_json["predicted_severity"]} ({pred_json["severity_category"]})')
    print('  Class Probabilities:')
    for p in pred_json['class_probabilities']:
        print(f'    - {p["label"]}: {p["percentage"]}%')
    print('[SERVER TEST] All endpoints verified successfully!')

