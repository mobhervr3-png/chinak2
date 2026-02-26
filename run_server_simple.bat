@echo off
echo Starting server... > server_log.txt
cd server
node index.js >> ..\server_log.txt 2>&1
