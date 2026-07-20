/**
 * Pure pipeline logic for the living compatibility matrix — merge, diff, and
 * change-detection — extracted from the CLI scripts so the whole flow is
 * integration-testable without touching the filesystem.
 *
 * The design goals this file encodes:
 *  - **No date-churn.** A new dated snapshot is written only when the matrix's
 *    substance OR a verifying engine version actually changed ({@link matrixChanged}).
 *    Re-running weekly against unchanged data does NOT mint a new snapshot.
 *  - **Version provenance.** CI-verified cells carry `verifiedOn:{browser,version}`,
 *    so a Chromium 148→149 re-verification is a visible, dated event
 *    ({@link diffSnapshots} `reverified`) — "auto-tested against new versions".
 */
import {
  MATRIX_SCHEMA_VERSION,
  MatrixDiffSchema,
  MergedMatrixSnapshotSchema,
  type CiSnapshot,
  type ManualSession,
  type MatrixDiff,
  type MatrixSnapshot,
  type MergedCell,
  type MergedMatrixSnapshot,
  type Tier,
  type VerifiedOn,
} from './matrixSchema';

/**
 * The verification tier is derived from what actually produced a cell's value
 * THIS run — never a static per-browser assumption. A cell is `tier-1-automated`
 * only when it was machine-verified (`ci`) or live-probed (`live`); everything
 * else — BCD/curated cross-references and hand-logged real-device sessions — is
 * `tier-2-manual`. So Edge reads T1 only on a run that truly had it, not by fiat.
 */
export function tierForSource(source: string): Tier {
  return source === 'ci' || source === 'live' ? 'tier-1-automated' : 'tier-2-manual';
}

/**
 * The CI harness reports the engine name on the runner OS (e.g. "Chromium");
 * map it onto the matrix's desktop browser+OS cells. Edge shares Blink+CDP.
 */
export const CI_BROWSER_MAP: Record<string, { browser: string; os: string }> = {
  Chromium: { browser: 'Chrome', os: 'desktop' },
  Chrome: { browser: 'Chrome', os: 'desktop' },
  Edge: { browser: 'Edge', os: 'Windows' },
};

export const cellId = (feature: string, browser: string, os: string): string =>
  `${feature}|${browser}|${os}`;
export const cellKey = (c: { feature: string; browser: string; os: string }): string =>
  cellId(c.feature, c.browser, c.os);

/** status | source | tier — the *substance* of a cell (ignores dates + engine versions). */
export const substanceFingerprint = (c: MergedCell): string => `${c.status}|${c.source}|${c.tier}`;

/** substance + the verifying engine version — "did anything meaningful change" for idempotency. */
export const changeFingerprint = (c: MergedCell): string =>
  `${substanceFingerprint(c)}|${c.verifiedOn ? `${c.verifiedOn.browser}@${c.verifiedOn.version}` : ''}`;

export interface MergeInputs {
  bcd: MatrixSnapshot | null;
  ci: CiSnapshot | null;
  /** Hand-logged real-device sessions (Safari/WebKit, Firefox, biometrics). */
  manual?: ManualSession[] | null;
  bcdFile: string | null;
  ciFile: string | null;
  builtAt: string;
}

/**
 * Merge the BCD baseline with hand-logged real-device sessions and the
 * CI-verified overrides into one dated matrix. Precedence (lowest→highest):
 * BCD/curated → manual real-device → CI machine-verified, so the freshest,
 * most-automated evidence wins a cell while manual sessions fill the engines CI
 * cannot reach.
 */
export function mergeMatrix(input: MergeInputs): MergedMatrixSnapshot {
  const { bcd, ci, manual, bcdFile, ciFile, builtAt } = input;
  const cells = new Map<string, MergedCell>();
  const upsert = (cell: Omit<MergedCell, 'tier'>): void => {
    cells.set(cellKey(cell), { ...cell, tier: tierForSource(cell.source) });
  };
  const labelFor = (feature: string): string =>
    bcd?.features.find((f) => f.id === feature)?.label ??
    bcd?.rows.find((r) => r.feature === feature)?.featureLabel ??
    feature;

  // 1. BCD / curated / passkeys.dev rows — the static baseline.
  if (bcd) {
    for (const row of bcd.rows) {
      upsert({
        feature: row.feature,
        featureLabel: row.featureLabel,
        browser: row.browser,
        os: row.os,
        status: row.status,
        source: row.source,
        lastVerified: row.pulledAt,
        since: row.since,
        ...(row.notes ? { notes: row.notes } : {}),
        ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
      });
    }
  }

  // 2. Manual real-device sessions override BCD for the cells they cover.
  if (manual) {
    for (const session of manual) {
      for (const f of session.features) {
        const detail = [
          f.notes,
          session.device ? `device: ${session.device}` : '',
          session.tester ? `by ${session.tester}` : '',
          session.notes,
        ]
          .filter(Boolean)
          .join(' — ');
        upsert({
          feature: f.feature,
          featureLabel: labelFor(f.feature),
          browser: session.browser,
          os: session.os,
          status: f.status,
          source: 'manual',
          lastVerified: session.date,
          ...(session.browserVersion
            ? { verifiedOn: { browser: session.browser, version: session.browserVersion } }
            : {}),
          ...(detail ? { notes: detail } : {}),
        });
      }
    }
  }

  // 3. CI rows override matching cells, and stamp the exact verifying engine version.
  const engineVersion = (name: string): string | undefined =>
    ci?.browsers.find((b) => b.name === name && b.available)?.version;
  if (ci) {
    for (const row of ci.rows) {
      const mapped = CI_BROWSER_MAP[row.browser];
      if (!mapped) continue;
      const version = engineVersion(row.browser);
      upsert({
        feature: row.feature,
        featureLabel: row.featureLabel,
        browser: mapped.browser,
        os: mapped.os,
        status: row.status,
        source: 'ci',
        lastVerified: row.pulledAt,
        ...(version ? { verifiedOn: { browser: row.browser, version } } : {}),
        ...(row.notes ? { notes: row.notes } : {}),
      });
    }
  }

  const mergedCells = [...cells.values()].sort(
    (a, b) =>
      a.feature.localeCompare(b.feature) ||
      a.browser.localeCompare(b.browser) ||
      a.os.localeCompare(b.os),
  );

  const features = bcd
    ? bcd.features.map((f) => ({ id: f.id, label: f.label }))
    : [...new Set(mergedCells.map((c) => c.feature))].map((id) => ({ id, label: id }));

  const engines: VerifiedOn[] = ci
    ? ci.browsers.filter((b) => b.available).map((b) => ({ browser: b.name, version: b.version }))
    : [];

  return MergedMatrixSnapshotSchema.parse({
    schemaVersion: MATRIX_SCHEMA_VERSION,
    builtAt,
    inputs: { bcd: bcdFile, ci: ciFile },
    provenance: {
      ...(bcd?.bcdVersion ? { bcdVersion: bcd.bcdVersion } : {}),
      ...(engines.length ? { engines } : {}),
    },
    features,
    cells: mergedCells,
  });
}

/**
 * Has the matrix meaningfully changed vs a prior merged snapshot? True when a
 * cell is added/removed, its substance moved, OR the engine version that
 * verified it moved. This is the gate that prevents date-churn: unchanged data
 * re-run on a new day returns `false` → no new snapshot is written.
 */
export function matrixChanged(
  prev: MergedMatrixSnapshot | null,
  next: MergedMatrixSnapshot,
): boolean {
  if (!prev) return true;
  const prevMap = new Map(prev.cells.map((c) => [cellKey(c), c]));
  const nextMap = new Map(next.cells.map((c) => [cellKey(c), c]));
  if (prevMap.size !== nextMap.size) return true;
  for (const [k, nc] of nextMap) {
    const pc = prevMap.get(k);
    if (!pc || changeFingerprint(pc) !== changeFingerprint(nc)) return true;
  }
  for (const k of prevMap.keys()) if (!nextMap.has(k)) return true;
  return false;
}

/**
 * Diff two dated merged snapshots. `changed/added/removed` capture substance
 * moves; `reverified` captures cells whose substance held but whose verifying
 * engine version advanced (the anti-staleness "still true on the newer browser"
 * signal). `lastVerified` dates are intentionally ignored — substance, not churn.
 */
export function diffSnapshots(
  fromSnap: MergedMatrixSnapshot,
  toSnap: MergedMatrixSnapshot,
  fromDate: string,
  toDate: string,
): MatrixDiff {
  const fromMap = new Map(fromSnap.cells.map((c) => [cellKey(c), c]));
  const toMap = new Map(toSnap.cells.map((c) => [cellKey(c), c]));

  const changed: MatrixDiff['changed'] = [];
  const added: MatrixDiff['added'] = [];
  const removed: MatrixDiff['removed'] = [];
  const reverified: MatrixDiff['reverified'] = [];

  for (const [k, after] of toMap) {
    const before = fromMap.get(k);
    if (!before) {
      added.push({ cell: k, now: substanceFingerprint(after) });
      continue;
    }
    if (substanceFingerprint(before) !== substanceFingerprint(after)) {
      changed.push({
        cell: k,
        before: substanceFingerprint(before),
        after: substanceFingerprint(after),
      });
    } else {
      const bv = before.verifiedOn?.version;
      const av = after.verifiedOn?.version;
      if (bv && av && bv !== av) {
        reverified.push({
          cell: k,
          fromVersion: `${before.verifiedOn?.browser ?? ''} ${bv}`.trim(),
          toVersion: `${after.verifiedOn?.browser ?? ''} ${av}`.trim(),
        });
      }
    }
  }
  for (const [k, before] of fromMap) {
    if (!toMap.has(k)) removed.push({ cell: k, was: substanceFingerprint(before) });
  }

  return MatrixDiffSchema.parse({
    schemaVersion: MATRIX_SCHEMA_VERSION,
    from: fromDate,
    to: toDate,
    changed,
    added,
    removed,
    reverified,
  });
}

/** Total substantive change count (excludes pure re-verifications). */
export const diffChangeCount = (d: MatrixDiff): number =>
  d.changed.length + d.added.length + d.removed.length;
