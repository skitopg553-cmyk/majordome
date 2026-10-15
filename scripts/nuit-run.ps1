# Un « run » de la session de nuit : lancé chaque heure par la tâche planifiée Majordome-nuit.
# La sortie (et les erreurs) s'ajoutent à nuit.log, ignoré par git.
Set-Location (Split-Path $PSScriptRoot)
"`n=== Run du $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===" | Out-File -Append -Encoding utf8 nuit.log
& "$env:APPDATA\npm\claude.ps1" -p "Lis docs/nuit.md et exécute-le intégralement." --dangerously-skip-permissions --model sonnet *>&1 |
  Out-File -Append -Encoding utf8 nuit.log
