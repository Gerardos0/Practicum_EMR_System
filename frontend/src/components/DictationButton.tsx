import { useEffect, useRef, useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import MicNoneOutlined from "@mui/icons-material/MicNoneOutlined";
import MicOutlined from "@mui/icons-material/MicOutlined";

// Web Speech API isn't in the TS DOM lib yet; keep the typing local.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

function getRecognitionCtor(): (new () => Recognition) | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Voice input for note fields (client: "support dictation/voice input"). Hidden where unsupported. */
export default function DictationButton({ onText, label }: { onText: (text: string) => void; label: string }) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition>(null);
  const Ctor = getRecognitionCtor();

  useEffect(() => () => rec.current?.stop(), []);
  if (!Ctor) return null;

  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) onText(e.results[i][0].transcript.trim());
      }
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };

  return (
    <Tooltip title={listening ? "Stop dictation" : "Dictate"}>
      <IconButton
        size="small" onClick={toggle} aria-pressed={listening}
        aria-label={listening ? `Stop dictating into ${label}` : `Dictate into ${label}`}
        color={listening ? "error" : "default"}
      >
        {listening ? <MicOutlined fontSize="small" /> : <MicNoneOutlined fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
