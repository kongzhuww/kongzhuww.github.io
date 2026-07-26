' Launches smtcbridge.py silently (no console window) using pythonw.
' Keep this file in the SAME folder as smtcbridge.py.
'
' To run at logon: press Win+R, type  shell:startup  , Enter, then drop a
' SHORTCUT to this .vbs into that Startup folder.
'
' If "pythonw" is not on PATH, replace it below with the full path, e.g.
'   "C:\Users\<you>\scoop\apps\miniforge3\current\pythonw.exe"

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = scriptDir
sh.Run "pythonw.exe """ & scriptDir & "\smtcbridge.py""", 0, False
