## 1. Delta Event Type

- [x] 1.1 Add `item_updated` to `DeltaEventType` union in `src/services/delta.ts`

## 2. Delta Detection Logic

- [x] 2.1 Add title change detection in `detectDeltas()` — compare `last.title` vs current `title`
- [x] 2.2 Add label change detection in `detectDeltas()` — sorted comparison to avoid false positives
- [x] 2.3 Ensure status change takes priority over title change (else-if chain)

## 3. Tests

- [x] 3.1 Create `src/test/services/delta.detectDeltas.item_updated.test.ts` with title change test
- [x] 3.2 Add label change detection test
- [x] 3.3 Add label reorder (no false positive) test
- [x] 3.4 Add status change priority over title change test
- [x] 3.5 Verify all existing delta tests still pass

## 4. Verification

- [x] 4.1 Run `npx tsc --noEmit` — verify zero errors
- [x] 4.2 Run full delta test suite — verify 100% pass rate
