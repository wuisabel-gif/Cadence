# LoRA-Cadence

Train a small QLoRA adapter that humanizes AI-slop prose, and measure it with
Cadence's own detector as the objective grader. The honest question: can a
rank-16 QLoRA on a ~3B base measurably lower the slop score on held-out text,
and how far does it close the gap to the prompt-based `recast`? A partial or
negative result is a valid outcome.

The detector (`deslop.mjs`) was built before and independently of this adapter,
so it is not a self-graded benchmark. Every number below comes from the real
detector, not a reimplementation.

## The eval rig ([eval.mjs](eval.mjs))

Built first, on purpose: prove the measurement before spending GPU time. It runs
the real `analyze()` over model outputs and reports score, grade, rhythm CV, and
per-tell counts. No GPU, no API, deterministic.

### Phase 3 — compare arms on the same held-out slop

```bash
node lora/eval.mjs base=out_base.jsonl lora=out_lora.jsonl prompt=out_prompt.jsonl
node lora/eval.mjs base=... lora=... --json
```

Each arm file is JSONL of `{"id": "...", "text": "<the arm's humanized output>"}`,
one object per line, matched by `id` across arms. The arm named `base` (or the
first one) is the baseline for deltas.

```
arm         N    mean  rhythm CV   grades (A/B/C/D/F)
base        4    35.5  0.198       1/1/1/0/1
recast      4       0  0.375       4/0/0/0/0
deltas vs base:  recast  score -35.5   CV +0.177
```

The delta line **always shows CV next to score**. A lower score with unchanged
rhythm CV means the model deleted flagged phrases without learning to vary
sentence length — gaming the surface. The rig makes that visible; the writeup
must say so if it happens.

### Phase 1 — filter training pairs to verified grade-A targets

```bash
node lora/eval.mjs --filter pairs.jsonl --max 15 --out kept.jsonl
```

`pairs.jsonl` is the training format `{"instruction","input","output"}`. This
keeps only lines whose `output` scores at or below `--max` (default 15) and
drops the rest, so the adapter trains on verified-good targets only. This is the
key step in Phase 1; the detector filter is a quality gate, not a guarantee, so
still hand-read a sample.

## The Kaggle notebook

[train_qwen_kaggle.ipynb](train_qwen_kaggle.ipynb) (authored as
[train_qwen_kaggle.py](train_qwen_kaggle.py), percent-format) runs the whole flow:
rank-16 QLoRA on Qwen2.5-3B, Phase-1 grade-A filter, train, generate each arm's
outputs, and grade with the real detector. Cell 3 proves the `deslop.mjs` wiring on
sample data before any GPU time. Leave `DRY_RUN = True` to execute end-to-end on the
sample data with no training; set it to False once your dataset is in place.

Turn on GPU and Internet in the Kaggle settings, and cache the base model as a
Kaggle Dataset after the first run. The grading and filter cells are verified; the
Unsloth/trl training cells follow the current quickstart and may need small tweaks as
those libraries drift.

## How the Kaggle notebook uses this

Node ships in Kaggle images. Add this repo as a Kaggle Dataset, then from the
notebook:

1. Each arm generates outputs for the held-out slop and writes them to a JSONL.
2. Shell out to the real detector:
   `subprocess.run(["node", "/kaggle/input/cadence/lora/eval.mjs", "base=base.jsonl", "lora=lora.jsonl", "--json"])`.
3. Parse the JSON and drop it into the results table.

The same script runs locally and on Kaggle with identical output, because the
detector is pure Node with zero dependencies.

## Two honest gates

- **No score without CV.** Reported by default; do not strip it.
- **Hand-check meaning.** The detector cannot catch a smoother sentence that
  dropped a fact. Read ~10 outputs and note any that did.

## `sample/`

[sample/base.jsonl](sample/base.jsonl) and [sample/recast.jsonl](sample/recast.jsonl)
are a four-line wiring demo, not real results — enough to prove the rig runs and
the table renders before any training happens.
