# Cadence demo — records a terminal GIF of the de-slop before/after.
#
# Generate it (from the repo root):
#   brew install vhs          # or: go install github.com/charmbracelet/vhs@latest
#   vhs assets/demo.tape      # writes assets/demo.gif
#
# Tweak Width/Height/FontSize below if the output is cropped on your terminal.

Output assets/demo.gif

Set Shell bash
Set FontSize 18
Set Width 1000
Set Height 800
Set Padding 24
Set Theme "Catppuccin Latte"

# Use the bundled detector so this works straight from a clone (no install).
Hide
Type "alias deslop='node skills/cadence/scripts/deslop.mjs'"
Enter
Type "clear"
Enter
Show

Type "# An AI-written draft:"
Enter
Sleep 700ms
Type "deslop assets/demo-before.txt"
Enter
Sleep 2.8s

Type "# Now recast in the plain voice, and re-score:"
Enter
Sleep 700ms
Type "deslop assets/demo-after.txt"
Enter
Sleep 3.5s
