const textToSpeech = require("@google-cloud/text-to-speech");
const ttsClient = new textToSpeech.TextToSpeechClient();

app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice = "female", rate = 1 } = req.body;

    const voiceName =
      voice === "male"
        ? "cmn-TW-Wavenet-B"
        : "cmn-TW-Wavenet-A";

    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: "cmn-TW",
        name: voiceName
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: Number(rate)
      }
    });

    res.json({
      audioContent: response.audioContent.toString("base64")
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "TTS 產生失敗" });
  }
});