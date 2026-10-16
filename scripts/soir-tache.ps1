# Crée (ou remplace) la tâche planifiée Windows « Majordome-soir ».
# powershell -ExecutionPolicy Bypass -File scripts\soir-tache.ps1
# Premier run dans 10 min, puis toutes les 45 min jusqu'à 23 h 30 ; pas de nouvelle instance si un run tourne déjà.
$projet = Split-Path $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\soir-run.ps1`"" -WorkingDirectory $projet

$debut = (Get-Date).AddMinutes(10)
$fin = (Get-Date).Date.AddHours(23).AddMinutes(30)
if ($fin -le $debut) { $fin = $fin.AddDays(1) }
$declencheur = New-ScheduledTaskTrigger -Once -At $debut `
  -RepetitionInterval (New-TimeSpan -Minutes 45) -RepetitionDuration ($fin - $debut)

$reglages = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -WakeToRun `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 3)

Register-ScheduledTask -TaskName "Majordome-soir" -Action $action -Trigger $declencheur -Settings $reglages -Force |
  Out-Null
"Tâche Majordome-soir créée : premier run le $($debut.ToString('dd/MM HH:mm')), jusqu'à $($fin.ToString('HH:mm'))."
