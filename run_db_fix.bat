@echo off
echo Running DB Fix... > db_fix_log.txt
cd server
node fix_mojibake_db.js >> ..\db_fix_log.txt 2>&1
