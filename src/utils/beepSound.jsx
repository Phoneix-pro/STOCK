

// Alternative simple beep using HTML5 Audio (more browser compatible)
export const playSimpleBeep = () => {
  try {
    // Create a short beep using oscillator via Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Frequency in Hz
    gainNode.gain.value = 1.0; // Volume
    
    oscillator.start();
    
    // Fade out quickly
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    
    setTimeout(() => {
      oscillator.stop();
    }, 150);
    
  } catch (error) {
    console.log('Audio not supported, using fallback');
    // Fallback: Try using HTML5 audio element
    try {
      const audio = new Audio();
      // eslint-disable-next-line no-undef
      const source = audioContext.createBufferSource();
      // Create a simple beep sound
      audio.src = "../assets/beep.mp3";
      audio.volume = 0.5;
      audio.play().catch(e => console.log("Audio play failed:", e));
    } catch (e) {
      console.log("All audio methods failed");
    }
  }
};