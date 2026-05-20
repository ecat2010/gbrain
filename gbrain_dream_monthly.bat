@echo off
REM GBrain 自动整理 (每月1号上午10点)
cd /d C:\Users\ecat2010\.gbrain
D:\gbrain-master\bin\gbrain.exe dream --dir "C:/Users/ecat2010/.gbrain" >> D:\gbrain-master\logs\dream.log 2>&1
