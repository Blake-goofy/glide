# Session Strip Performance Cache Plan

This note captures a future enhancement idea for Session Strip: show simple user performance indicators without running an expensive calculation on every workstation page load.

## Goal

Expose lightweight metrics in the workstation flow, such as:

- actual units completed
- expected units based on elapsed time
- percent to goal

Example:

- actual: 100 units
- expected: 120 units
- result: 83% of goal

## Why this is deferred

The underlying request is expensive enough that it should not run on every page refresh, every session refresh, or every start/stop action without a caching strategy.

## Candidate approach

- Maintain a database table that stores cached performance snapshots.
- Have the expensive calculation populate that cache table on a schedule instead of doing the full calculation on every workstation request.
- Let the workstation read from the cache table rather than from the expensive calculation path directly.

## Ideas worth exploring

- Refresh the database cache table every 15 minutes.
- Let the workstation read cached values on page load.
- Re-read cached values on start session and stop session.
- Add a local workstation-side cache so the app does not hit the database cache table on every refresh.
- Consider a local freshness window, such as only re-requesting if the last workstation fetch was more than 5 minutes ago.

## Open questions

- What exact metric definitions should be shown first?
- Is a 15 minute database snapshot cadence good enough operationally?
- Should start/stop session always force a fresh read, or should it still honor a short local cache window?
- Where should local cache state live, and how should it expire?
- What is the acceptable delay between real performance and displayed performance?

## Suggested next step

Before implementation, define the exact SQL/data source, expected cost, acceptable staleness, and the trigger points that should refresh the workstation view.