// Category Filtering Logic
    const filterButtons = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.transmission-card');

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');
        
        filterButtons.forEach(b => {
          b.className = 'filter-btn px-3 py-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors';
        });
        btn.className = 'filter-btn px-3 py-1.5 bg-primary text-on-primary font-medium transition-colors';

        cards.forEach(card => {
          const category = card.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    // Simulated Analog Playback Engine
    let isPlaying = true;
    let currentSeconds = 102;
    let totalSeconds = 324;

    function playTrack(title, durationStr, formatStr, badgeStr) {
      document.getElementById('player-title').textContent = title;
      document.getElementById('player-total-time').textContent = durationStr;
      document.getElementById('player-format').textContent = formatStr;
      document.getElementById('player-badge').textContent = badgeStr;

      const parts = durationStr.split(':');
      totalSeconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      currentSeconds = 0;
      
      isPlaying = true;
      updatePlayButtonUI();
      updateProgress();
    }

    function togglePlayState() {
      isPlaying = !isPlaying;
      updatePlayButtonUI();
    }

    function updatePlayButtonUI() {
      const icon = document.getElementById('master-play-icon');
      const statusBox = document.getElementById('player-status-icon');
      if (isPlaying) {
        icon.textContent = 'pause';
        statusBox.innerHTML = '<span class="material-symbols-outlined text-primary text-[18px] animate-pulse">graphic_eq</span>';
      } else {
        icon.textContent = 'play_arrow';
        statusBox.innerHTML = '<span class="material-symbols-outlined text-outline text-[18px]">pause</span>';
      }
    }

    function adjustTime(delta) {
      currentSeconds = Math.max(0, Math.min(totalSeconds, currentSeconds + delta));
      updateProgress();
    }

    function updateProgress() {
      const m = Math.floor(currentSeconds / 60);
      const s = currentSeconds % 60;
      document.getElementById('player-cur-time').textContent = 
        String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

      const pct = (currentSeconds / totalSeconds) * 100;
      document.getElementById('player-progress-bar').style.width = pct + '%';
      document.getElementById('player-progress-thumb').style.left = pct + '%';
    }

    // Scrubber click interaction
    document.getElementById('scrubber-bar').addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      currentSeconds = Math.floor(pct * totalSeconds);
      updateProgress();
    });

    // Time ticker
    setInterval(() => {
      if (isPlaying && currentSeconds < totalSeconds) {
        currentSeconds++;
        updateProgress();
      }
    }, 1000);
