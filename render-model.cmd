@echo off
REM Double-click this to re-render the frame sequences from the model.
REM The page reads public/frames, never the GLB, so this is the step that
REM makes a model change show up on the page.
cd /d "%~dp0"
call npm run frames:render
echo.
echo Done. Refresh the page in your browser.
pause
