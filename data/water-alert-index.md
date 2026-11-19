# Water alert index: what it is and how to keep it right

`water-alert-index.json` (this folder) is the single list of B-WF- water tags. One record per tag:

| Field | Meaning |
|---|---|
| `tag` | Exact tag text, e.g. `B-WF-Round Lake (Hayward, WI)`. Also the ISG Lofty company tag and the tag the water page's lead form adds. |
| `name` | Standard alert name (the tag without `B-WF-`). The zap finds and replaces alerts by this name. |
| `route` | `api` = the alert zap sets the alert. `plan` = a Lofty smart plan sets it; the zap does nothing. |
| `page` | The water page on northernwi.realestate. |
| `ring` | `[lat, lng]` points, 500 or fewer. The same shape the page searches. |
| `state` | States the alert is limited to. |
| `filter` | Extra search keys (rivers: `waterFrontY/N: ["Yes"]`). |
| `wbics` | DNR lake numbers, for reference only. Never in a tag. |

## The rule: four things stay in step

Each tag must exist in all four places, with identical text:

1. **The index** (this file, published at `https://raw.githubusercontent.com/kj7dvj2k/northernwi-realestate/main/data/water-alert-index.json`).
2. **ISG Lofty company tags** (Settings > Company > Tags). The smart plan trigger can only use company tags.
3. **The "tag added" smart plan's tag list.** The plan only fires on the tags ticked in it.
4. **The water page** on the site: its search shape matches `ring`, and its lead form adds `tag`.

## Adding a water

1. Build the page and its ring (zero off-water listings, every MLS-waterfront listing kept).
2. Add the record to the index. Name it by the tag rules (`B-WF-{Lake} ({Town}, WI)`; county when no town has 80% of the frontage; `(Northern WI)` only when it causes no clash; a two-letter abbreviation tie-break for same-named lakes in one town; no WBIC). Choose `route: api` unless the plan test below says otherwise.
3. Create the company tag in ISG Lofty, same text.
4. Tick the new tag in the "tag added" smart plan.
5. Point the page's lead form at the tag.
6. Republish the index to GitHub.
7. Test: add the tag to the test lead and check the alert appears under the standard name and returns the same listings as the page.

## Changing a water

- **Ring or filter change:** update the page and the index together, republish, then run the retrofit so every existing alert with that name gets the new criteria.
- **Tag text never changes once issued.** A rename means a new tag, a migration of holders, and retiring the old tag from all four places.
- **Removing a water:** take it off the page and the form first, untick it in the plan, then remove the record. Leave the company tag until no lead carries it.

## API or smart plan

- **Default is `api`.** One zap serves every water, and a bad ring is fixed for every alert at once.
- **Use `plan` only when the API can't express the search well enough**, for example when Water Body or another filter the API can't set gives clearly better results. Then build one smart plan for that tag, set `route: plan`, and the zap skips it.
- Decide case by case, as the need shows up. No smart plan per lake by default.

## Checks before publishing

- Every `tag` starts with `B-WF-` and is unique.
- Every `ring` has 3 to 500 points.
- Count of index records = count of B-WF- company tags = count of tags ticked in the plan.
