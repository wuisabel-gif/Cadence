# %% [markdown]
# # LoRA-Cadence: train a slop-humanizing QLoRA, graded by Cadence's real detector
#
# Rank-16 QLoRA on Qwen2.5-3B-Instruct. The objective grader is `deslop.mjs` from
# the Cadence repo, called as a subprocess, not reimplemented. The honest question:
# can a tiny local adapter measurably lower the slop score on held-out text, and
# how far does it close the gap to the prompt-based `recast`?
#
# **Before running:** turn on GPU (T4) and Internet in the notebook settings. Cache
# the base model as a Kaggle Dataset after the first run to protect your quota.
#
# The notebook proves the grading wiring on sample data FIRST (cell 3), before any
# GPU time. Start with `RUN_MODE = "dry"` to execute end-to-end on the repo's sample data;
# set it to False once your own dataset is in place.

# %%
# ---- config ----
RUN_MODE = "dry"  # one of: dry (no GPU), smoke (2 GPU steps), train (full run)
DATASET_PATH = None  # e.g. "/kaggle/input/my-cadence-pairs"
OUTPUT_DIR = "/kaggle/working/cadence-output"
SEED = 42

BASE_MODEL = "unsloth/Qwen2.5-3B-Instruct-bnb-4bit"
LORA_R, LORA_ALPHA, LORA_DROPOUT = 16, 32, 0.05
MAX_SEQ = 2048
GRADE_A_MAX = 10          # target quality floor for training pairs (Cadence grade A = score <= 10)
MAX_TRAIN_STEPS = 200 if RUN_MODE == "train" else 2

# The one instruction both training and inference use.
HUMANIZE = ("Rewrite the text so it reads like a person wrote it: vary sentence length, "
            "cut hollow-confidence words and cliches, no em-dashes. Keep the meaning and every "
            "fact intact. Output only the rewrite.")

# %%
# ---- cell 3: wire and PROVE the real detector before any GPU time ----
import os, subprocess, json, shutil, random, platform, pathlib, zipfile

assert RUN_MODE in {"dry", "smoke", "train"}, "RUN_MODE must be dry, smoke, or train"
random.seed(SEED)
os.makedirs(OUTPUT_DIR, exist_ok=True)

def fail(message):
    raise RuntimeError(f"Kaggle setup: {message}")

def preflight():
    print(f"Python {platform.python_version()} · mode={RUN_MODE} · seed={SEED}")
    if RUN_MODE in {"smoke", "train"}:
        import torch
        if not torch.cuda.is_available(): fail("select a GPU accelerator before smoke/train mode")
        print("GPU:", torch.cuda.get_device_name(0))

preflight()

# Get the Cadence repo. Prefer it added as a Kaggle Dataset; else clone it.
REPO = None
for cand in ["/kaggle/input/cadence", "/kaggle/input/Cadence", "/kaggle/working/Cadence", os.getcwd()]:
    if os.path.exists(os.path.join(cand, "lora", "eval.mjs")):
        REPO = cand; break
if REPO is None:
    subprocess.run(["git", "clone", "--depth", "1",
                    "https://github.com/wuisabel-gif/Cadence.git",
                    "/kaggle/working/Cadence"], check=True)
    REPO = "/kaggle/working/Cadence"
print("Cadence repo:", REPO)

def ensure_node():
    if shutil.which("node"):
        return
    # conda ships a recent Node on Kaggle; deslop.mjs needs Node 18+.
    subprocess.run(["conda", "install", "-y", "-c", "conda-forge", "nodejs"], check=True)

def grade_json(arms):
    """arms: {name: path_to_jsonl}. Returns parsed metrics from the real detector."""
    ensure_node()
    cmd = ["node", f"{REPO}/lora/eval.mjs"] + [f"{k}={v}" for k, v in arms.items()] + ["--json"]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)

def grade_table(arms):
    """Print the human-readable three-arm table (score, rhythm CV, per-tell)."""
    ensure_node()
    cmd = ["node", f"{REPO}/lora/eval.mjs"] + [f"{k}={v}" for k, v in arms.items()]
    print(subprocess.run(cmd, capture_output=True, text=True).stdout)

def filter_pairs(src, dst, max_score=GRADE_A_MAX):
    """Keep only training pairs whose `output` scores <= max_score (Phase 1 gate)."""
    ensure_node()
    r = subprocess.run(["node", f"{REPO}/lora/eval.mjs", "--filter", src,
                        "--max", str(max_score), "--out", dst],
                       capture_output=True, text=True, check=True)
    print(r.stderr.strip())

# SMOKE TEST: grade the repo's sample arms. This must work before we train anything.
grade_table({"base": f"{REPO}/lora/sample/base.jsonl",
             "recast": f"{REPO}/lora/sample/recast.jsonl"})

# %% [markdown]
# ## Phase 1 - dataset (the bottleneck)
#
# Give it ONE file: `raw_pairs.jsonl` of `{"instruction","input","output"}` (each
# `output` a prompt-`recast` humanization made with your API key, before this notebook;
# add an optional `"source"` field per row for a leak-free split). The notebook then
# filters to grade-A targets and carves out the held-out eval set itself. In dry mode it
# synthesizes a tiny raw file from the sample data so the whole flow runs.

# %%
import json, hashlib

TRAIN_PAIRS = os.path.join(OUTPUT_DIR, "train_pairs.jsonl")     # verified + train-split
HELDOUT = os.path.join(OUTPUT_DIR, "heldout_slop.jsonl")        # auto-carved, model never sees these
HOLDOUT_FRAC = 0.15

def read_jsonl(p): return [json.loads(l) for l in open(p) if l.strip()]
def write_jsonl(p, rows): open(p, "w").write("\n".join(json.dumps(r) for r in rows) + "\n")

if RUN_MODE == "dry":
    base = read_jsonl(f"{REPO}/lora/sample/base.jsonl")
    recast = read_jsonl(f"{REPO}/lora/sample/recast.jsonl")
    write_jsonl(os.path.join(OUTPUT_DIR, "raw_pairs.jsonl"),
                [{"id": b["id"], "source": "sample", "instruction": HUMANIZE,
                  "input": b["text"], "output": r["text"]} for b, r in zip(base, recast)])
    RAW = os.path.join(OUTPUT_DIR, "raw_pairs.jsonl")
else:
    candidates = list(pathlib.Path("/kaggle/input").glob("**/raw_pairs.jsonl")) if os.path.isdir("/kaggle/input") else []
    if DATASET_PATH:
        RAW = os.path.join(DATASET_PATH, "raw_pairs.jsonl")
    elif len(candidates) == 1:
        RAW = str(candidates[0])
    else:
        fail("attach one dataset containing raw_pairs.jsonl or set DATASET_PATH")

# The key gate: keep only pairs whose target the detector verifies as grade-A.
verified_path = os.path.join(OUTPUT_DIR, "verified.jsonl")
filter_pairs(RAW, verified_path, max_score=GRADE_A_MAX)
verified = read_jsonl(verified_path)
if not verified:
    fail("no pairs survived the Cadence grade-A filter")

# Auto held-out split: group by source (so a whole source is held out, not leaked
# across the split), deterministic, no manual second file.
verified.sort(key=lambda r: (str(r.get("source", "")),
                             hashlib.sha1(r.get("input", "").encode()).hexdigest()))
k = max(1, round(len(verified) * HOLDOUT_FRAC))
held, train = verified[:k], verified[k:]
write_jsonl(TRAIN_PAIRS, train)
write_jsonl(HELDOUT, [{"id": r.get("id", f"h{i}"), "input": r["input"]} for i, r in enumerate(held)])
pairs = train
print(f"{len(verified)} verified -> {len(train)} train / {len(held)} held-out (split by source)")

# %% [markdown]
# ## Phase 2 - train the QLoRA
# Skipped entirely under dry mode. Unsloth's API drifts; if an import fails, check the
# current Unsloth Kaggle quickstart and adjust the two cells below.

# %%
if RUN_MODE in {"smoke", "train"}:
    import subprocess as _sp
    _sp.run(["pip", "install", "-q", "unsloth"], check=True)

    import torch
    assert torch.cuda.is_available(), "No GPU. Set Accelerator -> GPU T4 in the notebook settings."
    from unsloth import FastLanguageModel

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL, max_seq_length=MAX_SEQ, load_in_4bit=True, dtype=None)
    model = FastLanguageModel.get_peft_model(
        model, r=LORA_R, lora_alpha=LORA_ALPHA, lora_dropout=LORA_DROPOUT,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth", random_state=42)

# %%
if RUN_MODE in {"smoke", "train"}:
    from datasets import Dataset
    from trl import SFTTrainer
    from transformers import TrainingArguments

    def to_text(ex):
        msgs = [{"role": "user", "content": ex["instruction"] + "\n\n" + ex["input"]},
                {"role": "assistant", "content": ex["output"]}]
        return {"text": tokenizer.apply_chat_template(msgs, tokenize=False)}

    ds = Dataset.from_list(pairs).map(to_text)
    bf16 = torch.cuda.is_bf16_supported()
    trainer = SFTTrainer(
        model=model, tokenizer=tokenizer, train_dataset=ds,
        dataset_text_field="text", max_seq_length=MAX_SEQ,
        args=TrainingArguments(
            per_device_train_batch_size=2, gradient_accumulation_steps=4,
            warmup_steps=5, max_steps=MAX_TRAIN_STEPS, learning_rate=2e-4,
            fp16=not bf16, bf16=bf16, logging_steps=10, optim="adamw_8bit",
            weight_decay=0.01, lr_scheduler_type="linear", seed=42, output_dir="outputs"))
    trainer.train()
    model.save_pretrained(os.path.join(OUTPUT_DIR, "cadence_lora"))   # the tiny adapter
    tokenizer.save_pretrained(os.path.join(OUTPUT_DIR, "cadence_lora"))

# %% [markdown]
# ## Phase 3 - generate each arm's outputs, then grade with the real detector

# %%
def make_generate():
    if RUN_MODE == "dry":
        return None
    from unsloth import FastLanguageModel
    FastLanguageModel.for_inference(model)
    def gen(slop):
        msgs = [{"role": "user", "content": HUMANIZE + "\n\n" + slop}]
        prompt = tokenizer.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        ids = tokenizer(prompt, return_tensors="pt").to("cuda")
        out = model.generate(**ids, max_new_tokens=400, do_sample=False)
        return tokenizer.decode(out[0][ids["input_ids"].shape[1]:], skip_special_tokens=True).strip()
    return gen

heldout = read_jsonl(HELDOUT)
OUT_BASE, OUT_LORA = os.path.join(OUTPUT_DIR, "out_base.jsonl"), os.path.join(OUTPUT_DIR, "out_lora.jsonl")

if RUN_MODE == "dry":
    # No model: build both arms from the held-out ids using the sample texts, so the
    # arms line up with the split and the table renders.
    held_ids = [r["id"] for r in heldout]
    sb = {x["id"]: x["text"] for x in read_jsonl(f"{REPO}/lora/sample/base.jsonl")}
    sr = {x["id"]: x["text"] for x in read_jsonl(f"{REPO}/lora/sample/recast.jsonl")}
    write_jsonl(OUT_BASE, [{"id": i, "text": sb[i]} for i in held_ids if i in sb])
    write_jsonl(OUT_LORA, [{"id": i, "text": sr[i]} for i in held_ids if i in sr])
else:
    gen = make_generate()
    with model.disable_adapter():                            # base = adapter off
        write_jsonl(OUT_BASE, [{"id": r["id"], "text": gen(r["input"])} for r in heldout])
    write_jsonl(OUT_LORA, [{"id": r["id"], "text": gen(r["input"])} for r in heldout])

# Optional Arm C (the ceiling): outputs from the prompt-based recast on a frontier
# model, generated with your API key elsewhere, dropped in as out_prompt.jsonl.
arms = {"base": OUT_BASE, "lora": OUT_LORA}
if os.path.exists(os.path.join(OUTPUT_DIR, "out_prompt.jsonl")):
    arms["prompt"] = os.path.join(OUTPUT_DIR, "out_prompt.jsonl")

# %%
# ---- the result: score + rhythm CV + per-tell, from the real detector ----
grade_table(arms)
results = grade_json(arms)
json.dump(results, open(os.path.join(OUTPUT_DIR, "results.json"), "w"), indent=2)
print("\nsaved results.json")

# %%
# ---- Phase 4: writeup + the two honesty gates, computed not narrated ----
R = {a["name"]: a for a in results["arms"]}
base, lora, prompt = R.get("base"), R.get("lora"), R.get("prompt")
dom_grade = lambda a: max(a["grades"], key=lambda k: a["grades"][k])

para = []
if base and lora:
    ds = lora["meanScore"] - base["meanScore"]
    dcv = lora["meanCV"] - base["meanCV"]
    para.append(f"Rank-{LORA_R} QLoRA on {BASE_MODEL}, {len(pairs)} training pairs verified "
                f"grade-A by Cadence's detector, evaluated on {lora['n']} held-out slop samples.")
    line = (f"Base model: mean {base['meanScore']} (grade {dom_grade(base)}). "
            f"LoRA: mean {lora['meanScore']} (grade {dom_grade(lora)}).")
    if prompt:
        gap = base["meanScore"] - prompt["meanScore"]
        closed = (base["meanScore"] - lora["meanScore"]) / gap if gap > 0 else float("nan")
        line += (f" Prompt-based recast: mean {prompt['meanScore']} (grade {dom_grade(prompt)})."
                 f" The adapter closed {closed*100:.0f}% of the base-to-prompt gap.")
    line += f" Rhythm CV moved base->LoRA by {dcv:+.3f}."
    fixed = [k for k in base["tells"] if base["tells"][k] > lora["tells"].get(k, 0)]
    missed = [k for k, v in lora["tells"].items() if v > 0]
    line += f" Fixed: {', '.join(fixed) or 'none'}. Still present: {', '.join(missed) or 'none'}."
    para.append(line)
    # Gate 1 - no score without CV: flag a drop that rhythm variance didn't earn.
    if ds < -5 and abs(dcv) < 0.03:
        para.append("WARNING: score fell but rhythm CV barely moved. The adapter likely deleted "
                    "flagged phrases without learning to vary sentence length. Report this, not just the score.")

writeup = "\n\n".join(para) or "Need both a base and a lora arm to write up."
open(os.path.join(OUTPUT_DIR, "writeup.md"), "w").write(writeup + "\n")
print(writeup)

# Gate 2 - tee up the hand meaning-check the detector cannot do.
print("\n--- read for dropped facts (input vs LoRA output) ---")
ho = {r["id"]: r["input"] for r in read_jsonl(HELDOUT)}
for r in read_jsonl(OUT_LORA)[:10]:
    print(f"\n[{r['id']}] IN : {ho.get(r['id'], '')[:200]}")
    print(f"[{r['id']}] OUT: {r['text'][:200]}")

config = {"run_mode": RUN_MODE, "base_model": BASE_MODEL, "seed": SEED, "grade_a_max": GRADE_A_MAX, "max_train_steps": MAX_TRAIN_STEPS}
json.dump(config, open(os.path.join(OUTPUT_DIR, "run-config.json"), "w"), indent=2)
with zipfile.ZipFile(os.path.join(OUTPUT_DIR, "cadence-output.zip"), "w", zipfile.ZIP_DEFLATED) as z:
    for p in pathlib.Path(OUTPUT_DIR).rglob("*"):
        if p.name != "cadence-output.zip" and p.is_file(): z.write(p, p.relative_to(OUTPUT_DIR))
print(f"\nArtifacts are in {OUTPUT_DIR}; download cadence-output.zip from the Kaggle Output tab.")
