$content = Get-Content src/events/interactionCreate.js -Raw
$content = $content -replace 'export default async function handleInteraction\(interaction\) \{', "export default {`n  name: 'interactionCreate',`n  async execute(interaction) {"

$pattern = '(?s)  \} catch \(error\) \{`n    console\.error\(''Interaction Error:'', error\);`n  \}`n\}`n`nasync function handleSecurityInteractions'
$replacement = "  } catch (error) {`n    console.error('Interaction Error:', error);`n  }`n  }`n};`n`nasync function handleSecurityInteractions"

$content = $content -replace $pattern, $replacement
Set-Content -Path src/events/interactionCreate.js -Value $content
