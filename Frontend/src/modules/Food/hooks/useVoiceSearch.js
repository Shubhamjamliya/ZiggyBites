import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

export const useVoiceSearch = (onResult) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [hasSupport, setHasSupport] = useState(true);
    const recognitionRef = useRef(null);
    const onResultRef = useRef(onResult);

    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setHasSupport(false);
        }
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (e) {
                // ignore
            }
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    const startListening = useCallback(async () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            toast.error("Voice search is not supported in this browser. Please try Chrome, Safari, or Edge.");
            return;
        }

        // Clean up any existing active recognition instance first
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (e) {
                // ignore
            }
            recognitionRef.current = null;
        }

        // Explicitly check / prompt for microphone permission via getUserMedia
        // This ensures the native browser permission dialog appears if not yet granted.
        if (navigator?.mediaDevices?.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // Immediately release the audio stream tracks so SpeechRecognition can take over the mic hardware
                stream.getTracks().forEach((track) => track.stop());
            } catch (permErr) {
                console.warn('Microphone permission check:', permErr);
                if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
                    toast.error("Microphone access denied. Please click the lock or settings icon in your browser address bar to allow microphone access.");
                    return;
                }
                if (permErr.name === 'NotFoundError' || permErr.name === 'DevicesNotFoundError') {
                    toast.error("No microphone detected on your device. Please connect a microphone.");
                    return;
                }
            }
        }

        try {
            const recognition = new SpeechRecognition();
            // Automatically adapt to the user's system language, fallback to en-IN
            const systemLang = navigator.language || navigator.userLanguage || 'en-IN';
            recognition.lang = systemLang;
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;

            setTranscript('');

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onresult = (event) => {
                let liveTranscript = '';
                let isFinal = false;

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result?.[0]?.transcript) {
                        liveTranscript += result[0].transcript;
                        if (result.isFinal) {
                            isFinal = true;
                        }
                    }
                }

                if (liveTranscript) {
                    setTranscript(liveTranscript);
                }

                if (isFinal && liveTranscript.trim()) {
                    const finalText = liveTranscript.trim();
                    if (onResultRef.current) {
                        onResultRef.current(finalText);
                    }
                    stopListening();
                }
            };

            recognition.onerror = (event) => {
                const errorType = event.error;
                console.warn('Speech recognition error:', errorType);

                // Ignore normal cancellation/abort
                if (errorType === 'aborted') {
                    return;
                }

                if (errorType === 'not-allowed') {
                    toast.error("Microphone permission blocked. Please allow microphone in browser settings.");
                } else if (errorType === 'no-speech') {
                    toast.error("No speech detected. Please tap the microphone and try again.");
                } else if (errorType === 'network') {
                    toast.error("Voice search network error. Please check your internet connection.");
                } else if (errorType === 'audio-capture') {
                    toast.error("No microphone detected. Please connect a microphone.");
                } else {
                    toast.error(`Voice search error: ${errorType}`);
                }
                stopListening();
            };

            recognition.onend = () => {
                setIsListening(false);
                recognitionRef.current = null;
            };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (error) {
            console.error('Speech recognition initialization failed:', error);
            toast.error("Could not start voice search. Please check your browser settings.");
            setIsListening(false);
        }
    }, [stopListening]);

    return {
        isListening,
        transcript,
        hasSupport,
        startListening,
        stopListening,
    };
};
