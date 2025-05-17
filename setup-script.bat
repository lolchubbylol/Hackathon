@echo off
echo ===== Orbital Simulation Setup =====
echo.
echo This script will set up all dependencies for the Orbital Simulation project.
echo.

REM Check for Python installation
echo Checking for Python...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.8 or newer from https://www.python.org/downloads/
    echo and make sure it's added to your PATH.
    goto :error
)

REM Check for Node.js installation
echo Checking for Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js 14 or newer from https://nodejs.org/
    echo and make sure it's added to your PATH.
    goto :error
)

echo All prerequisites are installed!
echo.

REM Set up backend
echo Setting up Python backend...
if not exist backend mkdir backend
if not exist backend\data mkdir backend\data

REM Create Python virtual environment
echo Creating Python virtual environment...
cd backend
python -m venv venv

REM Activate virtual environment and install dependencies
echo Installing Python dependencies...
call venv\Scripts\activate
pip install flask skyfield sgp4 numpy requests flask-cors
echo Backend dependencies installed.
call deactivate
cd ..

REM Download TLE data
echo Downloading Iridium TLE data...
curl -o backend\data\iridium_tle.txt https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-next^&FORMAT=tle
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Could not download Iridium TLE data.
    echo You may need to manually download TLE data from https://celestrak.org/
    echo and place it in the backend\data directory.
)

REM Set up frontend
echo Setting up React frontend...
if not exist frontend (
    echo Creating React app...
    npx create-react-app frontend --template typescript
    
    REM Create required directories
    if not exist frontend\src\components mkdir frontend\src\components
)

REM Install frontend dependencies
echo Installing frontend dependencies...
cd frontend
npm install axios three @react-three/fiber @react-three/drei react-globe.gl d3
cd ..

echo.
echo ===== Setup Complete! =====
echo.
echo To start the application:
echo 1. Run 'run.bat' from this directory
echo 2. Open http://localhost:3000 in your browser
echo.
echo Note: Make sure to copy your component files to the appropriate directories:
echo - OrbitSimulator.tsx and OrbitSimulator.css to frontend\src\components\
echo - app.py and orbital.py to the backend directory
echo.
pause
goto :eof

:error
echo.
echo Setup failed. Please fix the errors above and try again.
pause
