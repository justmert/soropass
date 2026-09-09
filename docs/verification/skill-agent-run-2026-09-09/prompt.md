# Prompt given to the agent, verbatim

Runner: Claude Code, a fresh general-purpose subagent with an empty context (model `claude-fable-5-1`), started 2026-09-09 10:54 UTC on macOS with Node v24.13.1 and npm 11.8.0. It had shell access, network access, and an empty working directory. It received nothing else: no repository, no docs, no prior conversation.

```
You are an independent developer with NO prior knowledge of this project. This is a black-box acceptance test with one rule: your ONLY source of information is the machine-readable skill file at https://soropass.dev/skill.md and the npm packages it tells you to install. You may fetch that one URL (with curl) as many times as you like. You must NOT open any other web page, must NOT read any file on this machine outside your working directory, must NOT look at any git repository, docs site, or source code. If the skill file is insufficient for a step, say exactly what was missing and stop that step; do not fill the gap from elsewhere.

Working directory (create files only here): <an empty directory>
Node v24.13.1 and npm 11.8.0 are installed. You have network access.

Tasks, in order:

1. Fetch the skill file with curl and save it as skill.md in the working directory. Record its size and the first 5 lines.
2. Following ONLY the skill file, reproduce the "create + sign" flow it describes with no browser: install what it says to install (record the exact resolved versions of every package from the lockfile or `npm ls`), copy its verify script byte for byte into a file, run it, and record the complete output. State whether the output matches the "expected output" the skill file specifies.
3. Following ONLY the skill file, run its testnet recipe end to end on the real Stellar testnet: fund a sponsor with friendbot as the skill says, create a real smart account through the account factory, and submit a passkey-signed transaction (whatever the skill's recipe submits, for example the payment recipe or add_signer). Record every transaction hash and the account address. Then check each transaction on the public Horizon testnet API (https://horizon-testnet.stellar.org/transactions/<hash>) and record the "successful" field for each. If the skill file gives a recipe that requires a browser passkey and offers no headless alternative, say so precisely and use whatever headless path the skill file itself documents (for example a mock or software signer, if it provides one); do not invent one.
4. Keep a log file named agent-log.md in the working directory. Append to it as you go, in order: a UTC timestamp, the exact command you ran, and its complete stdout/stderr verbatim (do not summarize or truncate outputs; if an output is longer than 300 lines, keep the first 150 and last 150 and say so). Every command you run must appear in this log.
5. Write a final report as final-report.md in the working directory with these sections: Environment (node, npm, resolved package versions, date); Procedure (what you did per task); Results (verify output verbatim, testnet account address, every tx hash with its Horizon "successful" value and a Stellar Expert link of the form https://stellar.expert/explorer/testnet/tx/<hash>); Deviations (anything you had to do that the skill did not say, or anything in the skill that was wrong or unclear, quoted); Verdict (did "create + sign using only the skill file" succeed on the first run: yes/no, and why).

Return the full contents of final-report.md as your answer. Be precise and honest; a failed step reported accurately is worth more than a step forced to pass.
```
