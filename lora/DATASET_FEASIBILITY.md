# External dataset feasibility for LoRA work

This document is a research gate, not an ingestion plan. No external dataset should
be added to `lora/` until its terms, provenance, and evaluation role are verified.
Dataset names below reflect leads that require primary-source confirmation.

## Decision criteria

A dataset is suitable only if its license permits the intended processing and
redistribution, its provenance is documented, its labels match the task, and its
examples can be separated from held-out evaluation. A large sample count is not
evidence of pairing quality or writing quality.

Do not use `deslop.mjs` as the sole ground truth for filtering targets or measuring
success. That would optimize the adapter toward the detector and then evaluate the
detector's own preferences. Use independent human judgments, source labels, or a
separately held-out evaluation protocol as appropriate.

## Feasibility matrix

| Candidate lead | Intended value | Must verify before use | Initial disposition |
| --- | --- | --- | --- |
| Defactify Text Dataset | Human articles and multiple AI rewrites may offer controlled source/variant comparisons | Dataset card license, NYT/source rights, exact pairing fields, model/version metadata, redistribution terms | Research only; no ingestion yet |
| LLM-DetectAIve | Fine-grained human, machine, humanized, and polished labels may expose failure modes | Dataset card license, label construction, definition of “humanized” and “polished,” duplicate sources, train/test contamination | Research only; inspect labels first |
| Human vs LLM Text Corpus | Broad human/AI scale | License, source provenance, language/domain balance, whether records are paired or only class-labeled | Research only; not automatically a rewrite corpus |
| HC3 | Same-prompt human/ChatGPT answers across domains | License, expert-answer rights, prompt/source overlap, model and collection dates, domain balance | Potential paired evaluation source after audit |
| Human-AI-Generated Text Corpus | Controlled prompt and rephrase variants | Repository/data license, source article rights, language quality, prompt metadata, split leakage | Research only; verify primary repository |
| RAID | Broad stress testing across models/domains | Access terms, redistribution, exact release version, label semantics, held-out sampling policy | Potential evaluation source after audit |
| SlopBench | Deterministic prompt/pattern validation | Official repository, license, prompt set, pattern definitions, model outputs and scoring contract | Validation lead, not training data |

The table is deliberately noncommittal. Dataset-card summaries or third-party
claims are not a substitute for checking the authoritative repository and license.

## Required audit record

Before a dataset is downloaded into the repository or training environment, record:

- Canonical URL, version, retrieval date, and checksum where practical
- License text and whether it permits commercial use, derivatives, and redistribution
- Original source and author/creator rights
- Label definitions and collection methodology
- Prompt/source pairing fields and whether variants are true rewrites
- Model names, versions, decoding settings, and generation dates
- Domain, language, length, and register distribution
- Duplicate and near-duplicate detection plan
- Train/development/test split boundaries
- Personal-data and sensitive-content handling
- Whether processed artifacts may be committed, cached, or redistributed

## Proposed evaluation protocol

1. Audit and record the license and provenance before processing.
2. Create source-level splits so variants of one prompt or article cannot cross a
   train/test boundary.
3. Keep a development set for rule or adapter decisions and freeze a held-out set.
4. Preserve an untouched human-written target set; do not assume a dataset's
   `human` label means stylistically ideal prose.
5. Evaluate recasts with independent measures: human preference or rubric scores,
   semantic preservation, edit quality, and detector behavior reported separately.
6. Report failures, including texts that become lower-scoring without becoming
   better writing.

## Go/no-go rule

Go only when licensing permits the exact intended use, provenance and pair semantics
are understood, splits prevent leakage, and the held-out evaluation is independent
of the detector and adapter training process. Otherwise keep the dataset as a
research lead and do not add it to the training pipeline.
