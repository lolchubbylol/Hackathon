@echo off
echo ===== PUSHING BACKEND TO GITHUB =====
echo.
echo This script will push your deployment backend code to GitHub.
echo You MUST create a GitHub repository first before running this script!
echo.

set /p REPO_URL="Enter your GitHub repository URL (like https://github.com/yourusername/repo.git): "

if "%REPO_URL%"=="" (
    echo No repository URL provided. Exiting.
    exit /b 1
)

echo.
echo Setting up Git repository for deploy/backend...
echo.

REM Navigate to the backend deployment directory
cd deploy\backend

REM Create a .gitignore file
echo __pycache__/ > .gitignore
echo *.pyc >> .gitignore
echo *.pyo >> .gitignore
echo *.pyd >> .gitignore
echo .Python >> .gitignore
echo venv/ >> .gitignore
echo .env >> .gitignore
echo .vscode/ >> .gitignore
echo .idea/ >> .gitignore

REM Initialize a new git repository
echo Initializing Git repository...
git init

REM Add all files to the staging area
echo Adding files to Git...
git add .

REM Commit the changes
echo Committing files...
git commit -m "Initial backend deployment commit"

REM Add the remote repository
echo Adding remote repository...
git remote add origin %REPO_URL%

REM Push to GitHub
echo Pushing to GitHub...
git branch -M main
git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Push failed. Please check your repository URL and credentials.
    echo.
    echo Common fixes:
    echo 1. Make sure you've created the repository on GitHub first
    echo 2. If prompted, enter your GitHub username and password or token
    echo 3. If you have 2FA enabled, use a Personal Access Token instead of password
    echo.
    echo You can also try pushing manually with these commands:
    echo   cd deploy\backend
    echo   git push -u origin main
) else (
    echo.
    echo SUCCESS! Your backend code has been pushed to GitHub.
    echo.
    echo Next steps:
    echo 1. Go to Render.com and create a new Web Service
    echo 2. Connect to your GitHub repository
    echo 3. Follow the deployment guide for the remaining steps
)

echo.
pause