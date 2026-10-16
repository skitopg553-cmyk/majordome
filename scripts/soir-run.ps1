# Un « run » de la session du soir : lancé toutes les 45 min par la tâche planifiée Majordome-soir.
# La sortie (et les erreurs) s'ajoutent à soir.log, ignoré par git.
Set-Location (Split-Path $PSScriptRoot)
"`n=== Run du $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===" | Out-File -Append -Encoding utf8 soir.log
& "$env:APPDATA\npm\claude.ps1" -p "Lis docs/soir.md et exécute-le intégralement." --dangerously-skip-permissions --model sonnet *>&1 |
  Out-File -Append -Encoding utf8 soir.log
