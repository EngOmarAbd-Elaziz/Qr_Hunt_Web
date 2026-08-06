# Troubleshooting

- **QR doesn't scan**: Ensure adequate lighting. The center letter overlay uses a high error-correction level, but camera glare can still affect it.
- **Race conditions**: If two players scan the exact same QR at the same second, the Postgres RPC uses `FOR UPDATE` to lock the row. Only the first request succeeds; the second gets "This fragment has already been discovered."
- **Drag & Drop not working**: Ensure users are not attempting to drag using multiple fingers (pinch zoom). The `@dnd-kit` library handles standard touch gestures accurately.
