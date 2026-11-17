# Lernpfad Voice

Free, private speech-to-text for answering Lernpfad lessons in mixed German and English.

- Runs OpenAI's Whisper speech model on your own device (via Transformers.js). It costs nothing, needs no account or key, and your voice never leaves the phone or laptop. The model downloads once (about 80 MB for the default) and is cached. The page itself works offline, but the speech library is loaded from a CDN, so the first recording on a device needs internet and offline recording is not guaranteed.
- Splits your answer at pauses, transcribes each phrase as soon as you pause, and marks which words are German or English.
- After you stop, you correct the text. The app measures how the answer sounded: pauses and where they fell, fillers and wordless hesitation sounds, restarts, the German/English share, and edits you made after speaking. From those it guesses your certainty, which you can change.
- "Copy for Lernpfad" copies your corrected answer plus a one-line `[Spoken: …]` note that Lernpfad's tutor reads.
