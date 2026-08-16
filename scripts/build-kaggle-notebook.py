#!/usr/bin/env python3
"""Generate the Kaggle notebook from the canonical percent-format Python file."""
import json
from pathlib import Path

source = Path('lora/train_qwen_kaggle.py').read_text().splitlines()
cells, current, kind = [], [], 'code'

def flush():
    if not current:
        return
    if kind == 'markdown':
        cells.append({'cell_type': 'markdown', 'metadata': {}, 'source': [f'{line}\n' for line in current]})
    else:
        cells.append({'cell_type': 'code', 'execution_count': None, 'metadata': {}, 'outputs': [], 'source': [f'{line}\n' for line in current]})
    current.clear()

for line in source:
    if line == '# %% [markdown]':
        flush(); kind = 'markdown'; continue
    if line.startswith('# %%'):
        flush(); kind = 'code'; continue
    current.append(line[1:].lstrip() if kind == 'markdown' and line.startswith('#') else line)
flush()

notebook = {
    'cells': cells,
    'metadata': {'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'}, 'language_info': {'name': 'python', 'version': '3.10'}, 'accelerator': 'GPU'},
    'nbformat': 4,
    'nbformat_minor': 5,
}
Path('lora/train_qwen_kaggle.ipynb').write_text(json.dumps(notebook, indent=1) + '\n')
print(f'generated lora/train_qwen_kaggle.ipynb ({len(cells)} cells)')
