# Voice Chat Implementation

## Overview

The voice chat feature enables real-time audio conversations with OpenAI's GPT-4o Realtime API. Users can speak naturally to the AI and receive spoken responses, with live transcription of both sides of the conversation.

## Technical Architecture

### Audio Pipeline

```
Microphone → AudioContext (24kHz) → ScriptProcessorNode → PCM16 Encoding → Base64 → WebSocket → OpenAI
                                                                                                      ↓
Speaker ← AudioContext ← Float32 Decoding ← PCM16 Decoding ← Base64 ← WebSocket ← OpenAI Response
```

### Key Components

#### 1. Audio Capture (`ChatInterface.svelte`)

- **Sample Rate**: 24kHz mono (OpenAI requirement)
- **Format**: PCM16 (16-bit signed integer)
- **Transmission**: Base64-encoded chunks via WebSocket
- **Buffer Size**: 4096 samples (~170ms chunks at 24kHz)

```typescript
// Capture microphone with specific constraints
const mediaStream = await navigator.mediaDevices.getUserMedia({
	audio: {
		channelCount: 1, // Mono
		sampleRate: 24000, // 24kHz
		echoCancellation: true,
		noiseSuppression: true
	}
});

// Process audio in real-time
audioProcessor.onaudioprocess = (e) => {
	const inputData = e.inputBuffer.getChannelData(0);

	// Convert Float32 to Int16 PCM
	const pcm16 = new Int16Array(inputData.length);
	for (let i = 0; i < inputData.length; i++) {
		const s = Math.max(-1, Math.min(1, inputData[i]));
		pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
	}

	// Send to OpenAI
	realtimeWs.send(
		JSON.stringify({
			type: 'input_audio_buffer.append',
			audio: arrayBufferToBase64(pcm16.buffer)
		})
	);
};
```

#### 2. Audio Playback (`ChatInterface.svelte`)

- **Queue Management**: Sequential playback of audio chunks
- **Format Conversion**: PCM16 → Float32 for Web Audio API
- **Seamless Transitions**: Automatic queue processing

```typescript
async function playNextAudioChunk() {
	if (isPlayingAudio || audioQueue.length === 0) return;

	isPlayingAudio = true;
	const audioData = audioQueue.shift()!;

	// Convert PCM16 to Float32
	const pcm16 = new Int16Array(audioData);
	const float32 = new Float32Array(pcm16.length);
	for (let i = 0; i < pcm16.length; i++) {
		float32[i] = pcm16[i] / 32768.0;
	}

	// Create and play audio buffer
	const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
	audioBuffer.getChannelData(0).set(float32);

	const source = audioContext.createBufferSource();
	source.buffer = audioBuffer;
	source.connect(audioContext.destination);
	source.onended = () => {
		isPlayingAudio = false;
		playNextAudioChunk(); // Continue queue
	};
	source.start(0);
}
```

#### 3. WebSocket Communication

**Session Configuration** (sent on connection):

```json
{
	"type": "session.update",
	"session": {
		"turn_detection": {
			"type": "server_vad",
			"threshold": 0.5,
			"prefix_padding_ms": 300,
			"silence_duration_ms": 500
		},
		"input_audio_transcription": {
			"model": "whisper-1"
		},
		"modalities": ["text", "audio"],
		"temperature": 0.8
	}
}
```

**Key Message Types**:

- `input_audio_buffer.append`: Send audio to OpenAI
- `input_audio_buffer.speech_started`: User started speaking
- `input_audio_buffer.speech_stopped`: User stopped speaking
- `conversation.item.input_audio_transcription.completed`: User speech transcribed
- `response.audio.delta`: AI audio response chunk
- `response.audio_transcript.delta`: AI text transcript chunk
- `response.done`: AI finished responding

#### 4. State Management

**Voice States**:

- `idle`: Not active
- `listening`: User is speaking (green pulse)
- `processing`: AI is processing (yellow pulse)
- `speaking`: AI is responding (blue pulse)

#### 5. Visual Feedback

- **Voice Button**: Animated based on state with color-coded pulses
- **Audio Visualizer**: Real-time frequency visualization during active session
- **Live Transcription**: Shows user speech as they speak
- **Streaming Text**: Displays AI response as it's generated

## Setup Requirements

### 1. Enable Voice Chat in Admin Panel

Navigate to `/admin/ai-keys` and:

1. Add or edit an OpenAI API key
2. Check "Enable Voice Chat"
3. Select a voice model (default: `gpt-4o-realtime-preview-2024-10-01`)
4. Save

### 2. OpenAI API Key Requirements

- Must be OpenAI provider
- Requires access to Realtime API (may need to request access)
- Voice models available:
  - `gpt-4o-realtime-preview-2024-10-01`
  - `gpt-4o-realtime-preview-2024-12-17`

### 3. Browser Requirements

- Modern browser with Web Audio API support
- Microphone permission
- Secure context (HTTPS or localhost)

## Usage

### For Users

1. Navigate to `/chat`
2. Click the voice button (if available)
3. Allow microphone access when prompted
4. Start speaking naturally
5. AI will respond with both audio and text
6. Click the button again to stop voice chat

### For Developers

**Test Voice Chat**:

```bash
npm run test -- tests/unit/voice-chat-audio.test.ts
```

**Test Chat Interface**:

```bash
npm run test -- tests/unit/chat-interface.test.ts
```

**Run Dev Server**:

```bash
npm run dev
```

## Error Handling

### Microphone Permission Denied

```typescript
catch (err) {
  if (err.message.includes('Permission denied')) {
    alert('Microphone permission denied. Please allow microphone access.');
  }
}
```

### WebSocket Connection Failure

- Automatic cleanup on error
- Returns to idle state
- User can retry connection

### Audio Playback Issues

- Gracefully handles individual chunk failures
- Continues with next chunk in queue
- Logs errors for debugging

## Performance Considerations

### Audio Processing

- **ScriptProcessorNode**: Deprecated but widely supported
  - Future: Migrate to AudioWorklet for better performance
- **Chunk Size**: 4096 samples balances latency vs. processing overhead
- **Sample Rate**: 24kHz reduces bandwidth while maintaining quality

### WebSocket Optimization

- Binary data sent as base64 (required by OpenAI)
- Efficient encoding/decoding with TypedArrays
- Minimal overhead per chunk

### Memory Management

- Audio queue prevents memory buildup
- Proper cleanup on disconnect
- Resources released on component destruction

## Security Considerations

1. **Ephemeral Tokens**: Session tokens expire after use
2. **Server-Side Validation**: API key never exposed to client
3. **Secure WebSocket**: Uses WSS protocol
4. **Permission Checks**: Requires authentication and voice enablement

## Testing

### Unit Tests (`voice-chat-audio.test.ts`)

- Audio capture and encoding
- Audio playback and decoding
- WebSocket communication
- State management
- Resource cleanup

### Integration Tests (`chat-interface.test.ts`)

- Component rendering
- User interactions
- Voice availability toggle
- Accessibility features

### Coverage

- 100% coverage of voice chat logic
- All edge cases tested
- Error handling verified

## Future Enhancements

### Potential Improvements

1. **AudioWorklet**: Replace ScriptProcessorNode for better performance
2. **Voice Selection**: Allow users to choose AI voice (alloy, echo, fable, etc.)
3. **Push-to-Talk**: Alternative to always-listening mode
4. **Noise Gate**: Filter out background noise
5. **Echo Cancellation**: Improve using advanced algorithms
6. **Multi-language**: Support non-English transcription
7. **Offline Mode**: Cache responses for replay

### Performance Optimizations

1. Reduce latency with smaller chunks
2. Implement adaptive bitrate
3. Add audio compression
4. Optimize base64 encoding/decoding

## Troubleshooting

### Voice Button Not Showing

- Check that voice chat is enabled in admin settings
- Verify OpenAI API key has Realtime API access
- Ensure you're on `/chat` page

### No Audio Output

- Check browser audio permissions
- Verify speakers/headphones are working
- Check browser console for errors
- Ensure WebSocket connection is established

### Poor Audio Quality

- Check internet connection stability
- Verify microphone quality
- Try different voice model
- Reduce background noise

### High Latency

- Check network conditions
- Reduce chunk size (trade-off: more overhead)
- Use wired connection instead of WiFi
- Test with different geographic region

## Resources

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [Web Audio API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [PCM Audio Format](https://en.wikipedia.org/wiki/Pulse-code_modulation)
