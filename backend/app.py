from flask import Flask, jsonify, request
from flask_cors import CORS
import datetime
import os
import json
from orbital import (
    load_tle_data,
    calculate_positions,
    calculate_visibility,
    create_sun_synchronous_orbit,
    create_non_polar_orbit,
    create_satellite_from_tle
)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "https://lolchubbylol.github.io"}})  # Enable CORS for all routes

# Get the absolute path to the data directory
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
TLE_FILE = os.path.join(DATA_DIR, 'iridium_tle.txt')

@app.route('/')
def index():
    return jsonify({
        "status": "online",
        "message": "Orbital Simulation API is running"
    })

@app.route('/api/satellites', methods=['GET'])
def get_satellites():
    try:
        satellites = load_tle_data(TLE_FILE)
        return jsonify({
            "count": len(satellites),
            "satellites": [{"name": sat["name"]} for sat in satellites]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/simulate', methods=['POST'])
def simulate():
    try:
        data = request.json
        
        # Extract parameters
        orbit_type = data.get('orbitType', 'sso')
        altitude = data.get('altitude', 700)
        inclination = data.get('inclination')
        ltan = data.get('ltan', 10.5)
        
        # Load Iridium constellation
        iridium_sats = load_tle_data(TLE_FILE)
        
        # Create custom satellite based on parameters
        if orbit_type == 'sso':
            custom_sat_tle = create_sun_synchronous_orbit(altitude, inclination, ltan)
        else:
            custom_sat_tle = create_non_polar_orbit(altitude, inclination or 45)
        
        custom_sat = create_satellite_from_tle(*custom_sat_tle, 'CUSTOM-SAT')
        
        # Calculate positions over 24 hours
        now = datetime.datetime.utcnow()
        end_time = now + datetime.timedelta(hours=24)
        step_minutes = 5  # Use 5-minute intervals for performance
        
        custom_sat_positions = calculate_positions([custom_sat], now, end_time, step_minutes)[0]
        
        # Only calculate first 10 Iridium satellites for performance in demo
        demo_iridium_sats = iridium_sats[:10]
        iridium_positions = calculate_positions(demo_iridium_sats, now, end_time, step_minutes)
        
        # Calculate visibility windows with each Iridium satellite
        visibility_results = []
        for idx, iridium_sat in enumerate(iridium_positions):
            windows = calculate_visibility(
                custom_sat_positions['positions'], 
                iridium_sat['positions'],
                max_distance_km=2500  # Typical Iridium cross-link distance
            )
            if windows:
                visibility_results.append({
                    'satellite': iridium_sat['name'],
                    'windows': windows
                })
        
        # Calculate connectivity statistics
        total_minutes = 24 * 60
        connected_timeline = [False] * total_minutes
        
        for sat_result in visibility_results:
            for window in sat_result['windows']:
                start_time = datetime.datetime.fromisoformat(window['start'])
                end_time = datetime.datetime.fromisoformat(window['end'])
                
                start_minutes = int((start_time - now).total_seconds() / 60)
                end_minutes = int((end_time - now).total_seconds() / 60)
                
                for i in range(max(0, start_minutes), min(end_minutes + 1, total_minutes)):
                    connected_timeline[i] = True
        
        connected_minutes = sum(connected_timeline)
        connectivity_percentage = (connected_minutes / total_minutes) * 100
        
        # Find gaps in connectivity
        gaps = []
        gap_start = None
        
        for i, connected in enumerate(connected_timeline):
            if not connected and gap_start is None:
                gap_start = i
            elif connected and gap_start is not None:
                gap_time = now + datetime.timedelta(minutes=gap_start)
                end_time = now + datetime.timedelta(minutes=i)
                
                gaps.append({
                    'start': gap_time.isoformat(),
                    'end': end_time.isoformat(),
                    'duration_minutes': i - gap_start
                })
                gap_start = None
        
        if gap_start is not None:
            gap_time = now + datetime.timedelta(minutes=gap_start)
            end_time = now + datetime.timedelta(minutes=total_minutes)
            
            gaps.append({
                'start': gap_time.isoformat(),
                'end': end_time.isoformat(),
                'duration_minutes': total_minutes - gap_start
            })
        
        return jsonify({
            'orbit_parameters': {
                'type': orbit_type,
                'altitude': altitude,
                'inclination': inclination,
                'ltan': ltan if orbit_type == 'sso' else None
            },
            'custom_satellite': {
                'name': 'CUSTOM-SAT',
                'positions': custom_sat_positions['positions']
            },
            'iridium_satellites': [
                {
                    'name': sat['name'],
                    'positions': sat['positions'][:24]  # Only return first 24 positions for bandwidth
                } for sat in iridium_positions[:5]  # Only return first 5 satellites for bandwidth
            ],
            'visibility_windows': visibility_results,
            'connectivity_stats': {
                'percentage': connectivity_percentage,
                'total_minutes': connected_minutes,
                'gaps': gaps
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
