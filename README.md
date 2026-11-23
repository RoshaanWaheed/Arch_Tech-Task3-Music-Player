# Arch Music Player

A web-based music player with a playlist, search, categories and full playback controls. Built with plain HTML, CSS and JavaScript, with no frameworks or libraries.

## Features

- Playlist of 8 built-in tracks, with the current track highlighted
- Search by title, artist or category
- Category filters: Chill, Focus, Energy, Ambient, My playlist and Uploads
- My playlist: save favourite tracks with the heart button (remembered after a refresh)
- Play, pause, next, previous, shuffle and repeat-one
- Seek bar and volume slider with mute
- Add your own audio files and play them in the same player
- Live visualizer: a spinning record with a spectrum ring that moves with the sound
- Keyboard shortcuts: Space to play or pause, N for next, P for previous
- Responsive layout, with light and dark mode that follows your device

## Technologies

- HTML5
- CSS3 (Grid, Flexbox, custom properties)
- JavaScript (ES6)
- Web Audio API
- Canvas API
- File API
- localStorage

## Project structure
```
index.html   page structure
style.css    styling and light/dark theme
script.js    playlist logic, audio engine and visualizer
README.md    project description
```

## How to run
1. Download or clone this repository.
2. Open `index.html` in any modern browser. No installation is needed.
3. Click a track, or press the Space key, to start playing.

## How it works
The built-in tracks are not audio files. Each track is a short description (tempo, musical scale, sound type and a seed number), and the Web Audio API turns it into music in real time using oscillators and generated drum sounds. Audio files you add yourself are played through an audio element that is connected to the same volume control and visualizer.



## Author

Roshaan Waheed
