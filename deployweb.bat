@echo off
echo ===== PREPARING YOUR APP FOR THE INTERNET =====
echo.

REM Create deployment folders
if not exist deploy mkdir deploy
if not exist deploy\backend mkdir deploy\backend
if not exist deploy\frontend mkdir deploy\frontend

REM Prepare backend for deployment
echo Preparing backend for Render.com...
copy backend\app.py deploy\backend\
copy backend\orbital.py deploy\backend\
if not exist deploy\backend\data mkdir deploy\backend\data
copy backend\data\iridium_tle.txt deploy\backend\data\

REM Create requirements.txt
echo flask > deploy\backend\requirements.txt
echo skyfield >> deploy\backend\requirements.txt
echo sgp4 >> deploy\backend\requirements.txt
echo numpy >> deploy\backend\requirements.txt
echo requests >> deploy\backend\requirements.txt
echo flask-cors >> deploy\backend\requirements.txt
echo gunicorn >> deploy\backend\requirements.txt

REM Create Procfile for Heroku (alternative)
echo web: gunicorn app:app > deploy\backend\Procfile

REM Create render.yaml for Render.com
echo services: > deploy\backend\render.yaml
echo   - type: web >> deploy\backend\render.yaml
echo     name: orbit-simulator-api >> deploy\backend\render.yaml
echo     env: python >> deploy\backend\render.yaml
echo     buildCommand: pip install -r requirements.txt >> deploy\backend\render.yaml
echo     startCommand: gunicorn app:app >> deploy\backend\render.yaml
echo     envVars: >> deploy\backend\render.yaml
echo       - key: PYTHON_VERSION >> deploy\backend\render.yaml
echo         value: 3.9.0 >> deploy\backend\render.yaml

REM Modify app.py to work online
echo Creating deployment-ready app.py...
(
echo import os
echo import datetime
echo import json
echo from flask import Flask, jsonify, request
echo from flask_cors import CORS
echo from orbital import (
echo     load_tle_data,
echo     calculate_positions,
echo     calculate_visibility,
echo     create_sun_synchronous_orbit,
echo     create_non_polar_orbit,
echo     create_satellite_from_tle
echo )
echo.
echo app = Flask(__name__)
echo CORS(app)
echo.
echo # Get the absolute path to the data directory
echo DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
echo TLE_FILE = os.path.join(DATA_DIR, 'iridium_tle.txt')
echo.
echo @app.route('/')
echo def index():
echo     return jsonify({
echo         "status": "online",
echo         "message": "Orbital Simulation API is running"
echo     })
echo.
echo @app.route('/api/satellites', methods=['GET'])
echo def get_satellites():
echo     try:
echo         satellites = load_tle_data(TLE_FILE)
echo         return jsonify({
echo             "count": len(satellites),
echo             "satellites": [{"name": sat["name"]} for sat in satellites]
echo         })
echo     except Exception as e:
echo         return jsonify({"error": str(e)}), 500
echo.
echo @app.route('/api/simulate', methods=['POST'])
echo def simulate():
echo     try:
echo         data = request.json
echo         
echo         # Extract parameters
echo         orbit_type = data.get('orbitType', 'sso')
echo         altitude = data.get('altitude', 700)
echo         inclination = data.get('inclination')
echo         ltan = data.get('ltan', 10.5)
echo         
echo         # Load Iridium constellation
echo         iridium_sats = load_tle_data(TLE_FILE)
echo         
echo         # Create custom satellite based on parameters
echo         if orbit_type == 'sso':
echo             custom_sat_tle = create_sun_synchronous_orbit(altitude, inclination, ltan)
echo         else:
echo             custom_sat_tle = create_non_polar_orbit(altitude, inclination or 45)
echo         
echo         custom_sat = create_satellite_from_tle(*custom_sat_tle, 'CUSTOM-SAT')
echo         
echo         # Calculate positions over 24 hours
echo         now = datetime.datetime.now(datetime.UTC)
echo         end_time = now + datetime.timedelta(hours=24)
echo         step_minutes = 5  # Use 5-minute intervals for performance
echo         
echo         custom_sat_positions = calculate_positions([custom_sat], now, end_time, step_minutes)[0]
echo         
echo         # Only calculate first 10 Iridium satellites for performance in demo
echo         demo_iridium_sats = iridium_sats[:10]
echo         iridium_positions = calculate_positions(demo_iridium_sats, now, end_time, step_minutes)
echo         
echo         # Calculate visibility windows with each Iridium satellite
echo         visibility_results = []
echo         for idx, iridium_sat in enumerate(iridium_positions):
echo             windows = calculate_visibility(
echo                 custom_sat_positions['positions'], 
echo                 iridium_sat['positions'],
echo                 max_distance_km=2500  # Typical Iridium cross-link distance
echo             )
echo             if windows:
echo                 visibility_results.append({
echo                     'satellite': iridium_sat['name'],
echo                     'windows': windows
echo                 })
echo         
echo         # Calculate connectivity statistics
echo         total_minutes = 24 * 60
echo         connected_timeline = [False] * total_minutes
echo         
echo         for sat_result in visibility_results:
echo             for window in sat_result['windows']:
echo                 start_time = datetime.datetime.fromisoformat(window['start'])
echo                 end_time = datetime.datetime.fromisoformat(window['end'])
echo                 
echo                 start_minutes = int((start_time - now).total_seconds() / 60)
echo                 end_minutes = int((end_time - now).total_seconds() / 60)
echo                 
echo                 for i in range(max(0, start_minutes), min(end_minutes + 1, total_minutes)):
echo                     connected_timeline[i] = True
echo         
echo         connected_minutes = sum(connected_timeline)
echo         connectivity_percentage = (connected_minutes / total_minutes) * 100
echo         
echo         # Find gaps in connectivity
echo         gaps = []
echo         gap_start = None
echo         
echo         for i, connected in enumerate(connected_timeline):
echo             if not connected and gap_start is None:
echo                 gap_start = i
echo             elif connected and gap_start is not None:
echo                 gap_time = now + datetime.timedelta(minutes=gap_start)
echo                 end_time = now + datetime.timedelta(minutes=i)
echo                 
echo                 gaps.append({
echo                     'start': gap_time.isoformat(),
echo                     'end': end_time.isoformat(),
echo                     'duration_minutes': i - gap_start
echo                 })
echo                 gap_start = None
echo         
echo         if gap_start is not None:
echo             gap_time = now + datetime.timedelta(minutes=gap_start)
echo             end_time = now + datetime.timedelta(minutes=total_minutes)
echo             
echo             gaps.append({
echo                 'start': gap_time.isoformat(),
echo                 'end': end_time.isoformat(),
echo                 'duration_minutes': total_minutes - gap_start
echo             })
echo         
echo         return jsonify({
echo             'orbit_parameters': {
echo                 'type': orbit_type,
echo                 'altitude': altitude,
echo                 'inclination': inclination,
echo                 'ltan': ltan if orbit_type == 'sso' else None
echo             },
echo             'custom_satellite': {
echo                 'name': 'CUSTOM-SAT',
echo                 'positions': custom_sat_positions['positions']
echo             },
echo             'iridium_satellites': [
echo                 {
echo                     'name': sat['name'],
echo                     'positions': sat['positions'][:24]  # Only return first 24 positions for bandwidth
echo                 } for sat in iridium_positions[:5]  # Only return first 5 satellites for bandwidth
echo             ],
echo             'visibility_windows': visibility_results,
echo             'connectivity_stats': {
echo                 'percentage': connectivity_percentage,
echo                 'total_minutes': connected_minutes,
echo                 'gaps': gaps
echo             }
echo         })
echo     except Exception as e:
echo         import traceback
echo         traceback.print_exc()
echo         return jsonify({"error": str(e)}), 500
echo.
echo if __name__ == '__main__':
echo     port = int(os.environ.get("PORT", 5000))
echo     app.run(host='0.0.0.0', port=port)
) > deploy\backend\app.py

REM Copy orbital.py (keeping it the same)
copy backend\orbital.py deploy\backend\orbital.py

REM Prepare frontend for deployment
echo Creating production-ready React frontend...

REM Create .env file for React to use the deployed API
echo REACT_APP_API_URL=https://your-backend-url.onrender.com > frontend\.env

REM Build the React app
cd frontend
call npm run build
cd ..

REM Copy the build folder to the deployment directory
xcopy /E /I frontend\build deploy\frontend

echo.
echo DEPLOYMENT PREPARATION COMPLETE!
echo.
echo Your deployment-ready files are in the 'deploy' folder.
echo Backend files: deploy\backend
echo Frontend files: deploy\frontend
echo.
echo NEXT STEPS:
echo 1. Upload backend to Render.com or another hosting service
echo 2. Upload frontend to Netlify or another static hosting service
echo 3. Update the REACT_APP_API_URL in the frontend to point to your deployed backend
echo.
pause