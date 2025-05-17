@echo off
echo ===== Starting Orbital Simulation Application =====

REM Start Python backend
echo Starting Python backend...
start cmd /k "cd backend && venv\Scripts\activate && python app.py"

REM Wait for backend to start
timeout /t 5

REM Start React frontend
echo Starting React frontend...
start cmd /k "cd frontend && npm start"

echo Application started!
echo - Backend running at http://localhost:5000
echo - Frontend running at http://localhost:3000