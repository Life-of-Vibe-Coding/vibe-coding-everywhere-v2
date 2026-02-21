import re

ws_file = "src/components/file/WorkspaceSidebar.tsx"
with open(ws_file, "r") as f:
    text = f.read()

# I will find the rogue "if (embedded) {\n    if (!visible) return null;\n" that is randomly stuck before "const renderFilesTab"
rogue_str = "if (embedded) {\n    if (!visible) return null;\n"
if rogue_str in text:
    patched = text.replace(rogue_str, "")
    with open(ws_file, "w") as f:
        f.write(patched)
        print("Patched!")
else:
    print("Not found")

# Also I need to remove the first "const overlayContent = (" which was included in ws_ret!
# Because ws_ret contained the original overlayContent as well!
