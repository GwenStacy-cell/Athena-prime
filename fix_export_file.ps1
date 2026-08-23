$content = Get-Content src/events/interactionCreate.js -Raw
$content = $content -replace "await interaction\.followUp\(\{ files: \[mp3Path\] \}\);", "await interaction.followUp({ files: [mp3Path] });`n          const fs = await import('fs');`n          fs.unlink(mp3Path, () => {});"
Set-Content -Path src/events/interactionCreate.js -Value $content
