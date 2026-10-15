# Crée (ou remplace) la tâche planifiée Windows « Majordome-nuit ».
# À lancer TOI-MÊME, une fois : powershell -ExecutionPolicy Bypass -File scripts\nuit-tache.ps1
# Prochain 01:35, puis toutes les 60 min pendant 7 h ; pas de nouvelle instance si un run tourne déjà.
$projet = Split-Path $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\nuit-run.ps1`"" -WorkingDirectory $projet

$debut = (Get-Date).Date.AddHours(1).AddMinutes(35)
if ($debut -lt (Get-Date)) { $debut = $debut.AddDays(1) }
$declencheur = New-ScheduledTaskTrigger -Once -At $debut `
  -RepetitionInterval (New-TimeSpan -Minutes 60) -RepetitionDuration (New-TimeSpan -Hours 7)

$reglages = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -WakeToRun `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 3)

Register-ScheduledTask -TaskName "Majordome-nuit" -Action $action -Trigger $declencheur -Settings $reglages -Force |
  Out-Null
"Tâche Majordome-nuit créée : premier run le $($debut.ToString('dd/MM HH:mm'))."
"Pour la supprimer : Unregister-ScheduledTask -TaskName Majordome-nuit -Confirm:`$false"
