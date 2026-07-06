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
# GPU time. Leave `DRY_RUN = True` to execute end-to-end on the repo's sample data;
# set it to False once your own dataset is in place.

# %%
# ---- config ----
DRY_RUN = True   # True: run the whole flow on repo sample data, no training. False: real run.

BASE_MODEL = "unsloth/Qwen2.5-3B-Instruct-bnb-4bit"
LORA_R, LORA_ALPHA, LORA_DROPOUT = 16, 32, 0.05
MAX_SEQ = 2048
GRADE_A_MAX = 10          # target quality floor for training pairs (Cadence grade A = score <= 10)
MAX_TRAIN_STEPS = 200     # keep short on a small set to avoid overfitting

# The one instruction both training and inference use.
HUMANIZE = ("Rewrite the text so it reads like a person wrote it: vary sentence length, "
            "cut hollow-confidence words and cliches, no em-dashes. Keep the meaning and every "
            "fact intact. Output only the rewrite.")

# %%
# ---- cell 3: wire and PROVE the real detector before any GPU time ----
import os, subprocess, json, shutil

# Get the Cadence repo. Prefer it added as a Kaggle Dataset; else clone it.
REPO = None
for cand in ["/kaggle/input/cadence", "/kaggle/input/Cadence", "/kaggle/working/Cadence"]:
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
# Provide `raw_pairs.jsonl` of `{"instruction","input","output"}` where each `output`
# is a prompt-`recast` humanization (generated with your API key, offline/before this
# notebook). Also provide `heldout_slop.jsonl` of `{"id","input"}` the model never
# trains on. In DRY_RUN we synthesize tiny stand-ins from the sample data so the flow
# runs without those files.

# %%
import json

TRAIN_PAIRS = "/kaggle/working/train_pairs.jsonl"     # verified, after the grade-A filter
HELDOUT = "/kaggle/working/heldout_slop.jsonl"

def read_jsonl(p): return [json.loads(l) for l in open(p) if l.strip()]
def write_jsonl(p, rows): open(p, "w").write("\n".join(json.dumps(r) for r in rows) + "\n")

if DRY_RUN:
    # Toy stand-ins: sample recast pairs become training data; sample base becomes held-out slop.
    base = read_jsonl(f"{REPO}/lora/sample/base.jsonl")
    recast = read_jsonl(f"{REPO}/lora/sample/recast.jsonl")
    raw = [{"instruction": HUMANIZE, "input": b["text"], "output": r["text"]}
           for b, r in zip(base, recast)]
    write_jsonl("/kaggle/working/raw_pairs.jsonl", raw)
    write_jsonl(HELDOUT, [{"id": b["id"], "input": b["text"]} for b in base])
    RAW = "/kaggle/working/raw_pairs.jsonl"
else:
    RAW = "/kaggle/input/YOUR_DATASET/raw_pairs.jsonl"   # <-- point at your data
    # heldout must also exist at HELDOUT; copy it from your dataset here.

# The key gate: keep only pairs whose target the detector verifies as grade-A.
filter_pairs(RAW, TRAIN_PAIRS, max_score=GRADE_A_MAX)
pairs = read_jsonl(TRAIN_PAIRS)
print(f"{len(pairs)} verified training pairs; {len(read_jsonl(HELDOUT))} held-out slop inputs")

# %% [markdown]
# ## Phase 2 - train the QLoRA
# Skipped entirely under DRY_RUN. Unsloth's API drifts; if an import fails, check the
# current Unsloth Kaggle quickstart and adjust the two cells below.

# %%
if not DRY_RUN:
    import subprocess as _sp
    _sp.run(["pip", "install", "-q", "unsloth"], check=True)

    from unsloth import FastLanguageModel
    import torch

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL, max_seq_length=MAX_SEQ, load_in_4bit=True, dtype=None)
    model = FastLanguageModel.get_peft_model(
        model, r=LORA_R, lora_alpha=LORA_ALPHA, lora_dropout=LORA_DROPOUT,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth", random_state=42)

# %%
if not DRY_RUN:
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
    model.save_pretrained("/kaggle/working/cadence_lora")   # the tiny adapter
    tokenizer.save_pretrained("/kaggle/working/cadence_lora")

# %% [markdown]
# ## Phase 3 - generate each arm's outputs, then grade with the real detector

# %%
def make_generate():
    if DRY_RUN:
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
OUT_BASE, OUT_LORA = "/kaggle/working/out_base.jsonl", "/kaggle/working/out_lora.jsonl"

if DRY_RUN:
    # No model: exercise grading with the sample arms so the table renders.
    import shutil as _sh
    _sh.copy(f"{REPO}/lora/sample/base.jsonl", OUT_BASE)     # stands in for "base arm"
    _sh.copy(f"{REPO}/lora/sample/recast.jsonl", OUT_LORA)   # stands in for "lora arm"
else:
    gen = make_generate()
    with model.disable_adapter():                            # base = adapter off
        write_jsonl(OUT_BASE, [{"id": r["id"], "text": gen(r["input"])} for r in heldout])
    write_jsonl(OUT_LORA, [{"id": r["id"], "text": gen(r["input"])} for r in heldout])

# Optional Arm C (the ceiling): outputs from the prompt-based recast on a frontier
# model, generated with your API key elsewhere, dropped in as out_prompt.jsonl.
arms = {"base": OUT_BASE, "lora": OUT_LORA}
if os.path.exists("/kaggle/working/out_prompt.jsonl"):
    arms["prompt"] = "/kaggle/working/out_prompt.jsonl"

# %%
# ---- the result: score + rhythm CV + per-tell, from the real detector ----
grade_table(arms)
results = grade_json(arms)
json.dump(results, open("/kaggle/working/results.json", "w"), indent=2)
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
open("/kaggle/working/writeup.md", "w").write(writeup + "\n")
print(writeup)

# Gate 2 - tee up the hand meaning-check the detector cannot do.
print("\n--- read for dropped facts (input vs LoRA output) ---")
ho = {r["id"]: r["input"] for r in read_jsonl(HELDOUT)}
for r in read_jsonl(OUT_LORA)[:10]:
    print(f"\n[{r['id']}] IN : {ho.get(r['id'], '')[:200]}")
    print(f"[{r['id']}] OUT: {r['text'][:200]}")

print("\nArtifacts to commit (NOT the base model): "
      "cadence_lora/, train_pairs.jsonl, heldout_slop.jsonl, results.json, writeup.md")
