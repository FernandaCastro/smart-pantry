# AI token control for the voice feature

## Best approach (recommended)

> Note: to keep governance and cost controls consistent, `ai-suggestions` should also use token-based limits (not request-count limits).

The most reliable and cost-effective production strategy is to combine **token budgets + time-window quotas + pre-call blocking before invoking the model**.

In this project context, the app already stores usage in `ai_usage` and enforces a 24-hour rolling limit for `ai-suggestions`. The ideal evolution for voice is:

1. **Split usage by feature**
   - Record voice AI calls as `feature = 'voice-assistant'`.
   - Keep independent limits for each feature (`ai-suggestions`, `voice-assistant`, etc.).

2. **Move from request limits to token limits**
   - Before: limit by number of calls (e.g., 30 requests / 24h).
   - After: limit by `total_tokens` consumed in the window (e.g., 12,000 tokens / 24h for voice).

3. **Double-check in the backend**
   - **Pre-call**: if the user has already exhausted the token budget for the window, return 429 without calling the model.
   - **Post-call**: persist real provider usage (`input_tokens`, `output_tokens`, `total_tokens`) to keep accounting accurate.

4. **Per-user limit + global safety limit**
   - `user_daily_token_limit`: prevents individual abuse.
   - `project_daily_token_limit` (optional): a global cost kill-switch.

5. **Clear UX response**
   - On 429, return payload fields such as:
     - `remaining_tokens`
     - `reset_at`
     - localized message for the voice UI.

---

## Suggested data model

Add columns to `ai_usage`:

- `request_tokens integer`
- `response_tokens integer`
- `total_tokens integer`
- `provider text` (e.g., `gemini`)
- `model text` (e.g., `gemini-2.5-flash`)

Optional (more flexible): a per-user/feature quota table:

- `ai_limits(user_id, feature, daily_token_limit, updated_at)`

This supports plans (free/pro) without constant code changes.

---

## Recommended voice flow

1. Client sends audio/text to a **voice Edge Function** (never call AI directly from the frontend).
2. Function authenticates the user.
3. Function sums `total_tokens` for `voice-assistant` over the last 24 hours.
4. If over limit, return 429.
5. If allowed, call the model.
6. Persist real token usage in `ai_usage`.
7. Return output + current usage for UI feedback.

---

## Practical starting values (MVP)

- Free:
  - `voice-assistant`: 8k–12k tokens / 24h
- Pro:
  - `voice-assistant`: 60k+ tokens / 24h

Tune after 1–2 weeks by observing:
- average tokens per voice command,
- limit-hit rate,
- real daily cost.

---

## Implementation checklist

- [ ] Add migration for token columns in `ai_usage`.
- [ ] Update Edge Functions to validate token limits (not only request counts).
- [ ] Persist provider `usageMetadata`.
- [ ] Return remaining quota feedback to the app.
- [ ] Add daily global cost alerts.
