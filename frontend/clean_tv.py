import re

tv_path = 'c:/Users/TADS/WORK/TADSTech/WXATA/frontend/src/pages/TvDashboard.tsx'

with open(tv_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove unused components
content = re.sub(r'// ─── ScriptManager ────────────────────────────────────────────────────────────.*?// ─── PermissionsEditor ────────────────────────────────────────────────────────', r'// ─── PermissionsEditor ────────────────────────────────────────────────────────', content, flags=re.DOTALL)
content = re.sub(r'// ─── PermissionsEditor ────────────────────────────────────────────────────────.*?// ─── TVConfigEditor ──────────────────────────────────────────────────────────', r'// ─── TVConfigEditor ──────────────────────────────────────────────────────────', content, flags=re.DOTALL)
content = re.sub(r'// ─── WelcomeEditor ────────────────────────────────────────────────────────────.*?// ─── Dashboard \(main component\) ───────────────────────────────────────────────', r'// ─── Dashboard (main component) ───────────────────────────────────────────────', content, flags=re.DOTALL)

# Remove unused state and handler lines
content = re.sub(r'  const \[expandedScript.*?\n', '', content)
content = re.sub(r'  const \[addingScript.*?\n', '', content)
content = re.sub(r'  const \[newScriptDraft.*?\}\);\n', '', content, flags=re.DOTALL)

content = re.sub(r'  const handleScriptFieldChange =.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handleScriptArgumentChange =.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handleDeleteScript =.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handleAddScript =.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handleScriptReorder =.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handlePublishScript =.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handleMarketplaceInstall =.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handlePermissionsSave =.*?};\n', '', content, flags=re.DOTALL)
content = re.sub(r'  const handleWelcomeSave =.*?};\n', '', content, flags=re.DOTALL)

with open(tv_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Cleaned TvDashboard.tsx")
