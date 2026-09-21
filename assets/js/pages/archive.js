(function() {
    // Dynamic Filter Behavior with Media Support
    const filterButtons = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.archive-card');

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');

        // Update active button state
        filterButtons.forEach(b => {
          b.classList.remove('bg-primary', 'text-on-primary');
          b.classList.add('bg-surface-container-low', 'text-on-surface-variant');
        });
        btn.classList.add('bg-primary', 'text-on-primary');
        btn.classList.remove('bg-surface-container-low', 'text-on-surface-variant');

        // Filter cards smoothly
        cards.forEach(card => {
          const category = card.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            card.style.display = 'flex';
            setTimeout(() => {
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, 10);
          } else {
            card.style.opacity = '0';
            card.style.transform = 'translateY(12px)';
            setTimeout(() => {
              card.style.display = 'none';
            }, 200);
          }
        });
      });
    });

    // SoundCloud play toggle simulation
    window.toggleSoundcloudPlay = function(btn) {
      const icon = btn.querySelector('.material-symbols-outlined');
      const label = document.querySelector('.sc-status-label');
      if (icon.innerText === 'play_arrow') {
        icon.innerText = 'pause';
        if (label) label.innerText = 'PLAYING 4-TRACK STEREO BOUNCE';
      } else {
        icon.innerText = 'play_arrow';
        if (label) label.innerText = 'PAUSED · CLICK TO AUDITION';
      }
    };

    // Cassette Player Animation & Playback Simulation
    let cassettePlaying = false;
    let cassetteInterval;
    let seconds = 0;

    window.toggleCassettePlay = function(btn) {
      cassettePlaying = !cassettePlaying;
      const reels = document.querySelectorAll('.tape-reel');
      const btnIcon = btn.querySelector('.material-symbols-outlined');
      const btnText = btn.querySelector('span:last-child');
      const timer = document.querySelector('.tape-timer');

      if (cassettePlaying) {
        reels.forEach(r => r.classList.add('animate-spin-slow'));
        reels.forEach(r => r.classList.remove('paused'));
        btnIcon.innerText = 'pause';
        btnText.innerText = 'STOP TAPE';
        cassetteInterval = setInterval(() => {
          seconds++;
          const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
          const secs = String(seconds % 60).padStart(2, '0');
          if (timer) timer.innerText = `${mins}:${secs} / 02:45`;
          if (seconds >= 165) {
            clearInterval(cassetteInterval);
            seconds = 0;
            toggleCassettePlay(btn);
          }
        }, 1000);
      } else {
        reels.forEach(r => r.classList.add('paused'));
        btnIcon.innerText = 'play_arrow';
        btnText.innerText = 'ROLL TAPE';
        clearInterval(cassetteInterval);
      }
    };

    // Inspect Card Interaction & Dynamic Modal Populator
    const modal = document.getElementById('inspect-modal');
    const closeBtn = document.getElementById('modal-close');
    const dismissBtn = document.getElementById('modal-dismiss');
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');
    const modalCat = document.getElementById('modal-cat');
    const modalGear = document.getElementById('modal-gear');
    const modalNotes = document.getElementById('modal-notes');
    const modalMediaFrame = document.getElementById('modal-media-frame');

    cards.forEach(card => {
      card.addEventListener('click', () => {
        const title = card.querySelector('h2')?.innerText || 'Archive Artifact';
        const desc = card.querySelector('p.text-on-surface-variant')?.innerText || '';
        const cat = card.querySelector('.p-space-sm span:last-child')?.innerText || '#SKC-ARCH';
        const gear = card.getAttribute('data-gear') || 'Standard Studio Hardware';
        const notes = card.getAttribute('data-notes') || 'Stored in environmental chamber.';
        const type = card.getAttribute('data-type') || 'photo';

        modalTitle.innerText = title;
        modalDesc.innerText = desc;
        modalCat.innerText = cat;
        modalGear.innerText = gear;
        modalNotes.innerText = notes;

        // Custom rich media embed preview inside drawer modal
        if (type === 'youtube') {
          modalMediaFrame.innerHTML = `
            <div class="relative aspect-video bg-black crt-scanlines">
              <iframe class="w-full h-full" src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&controls=1&rel=0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
          `;
        } else if (type === 'soundcloud') {
          modalMediaFrame.innerHTML = `
            <div class="p-space-md bg-surface-container flex flex-col gap-3">
              <div class="flex items-center justify-between font-label-code text-label-code text-primary">
                <span>SOUNDCLOUD ANALOG MASTER STREAM</span>
                <span>4-TRACK TAPE BOUNCE</span>
              </div>
              <div class="p-3 bg-surface-dim border border-surface-container-highest flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-primary text-[28px]">graphic_eq</span>
                  <div class="flex flex-col">
                    <span class="font-headline-sm text-sm text-on-surface">Orbit (궤도) - Rough Rehearsal Master</span>
                    <span class="text-outline font-label-micro">Hapjeong Basement · 192kbps Lossless Feed</span>
                  </div>
                </div>
                <a href="https://soundcloud.com" target="_blank" class="px-3 py-1 bg-primary text-on-primary font-label-code text-label-micro">LISTEN ON SC ↗</a>
              </div>
            </div>
          `;
        } else if (type === 'instagram') {
          modalMediaFrame.innerHTML = `
            <div class="p-space-md bg-surface-container flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-primary text-[24px]">photo_camera</span>
                <div>
                  <span class="font-label-code text-on-surface text-label-code">@sakarin_cosmos instagram post</span>
                  <p class="text-body-sm text-outline">Rehearsal loop testing with taped pedal chain.</p>
                </div>
              </div>
              <a href="https://instagram.com" target="_blank" class="px-3 py-1 bg-surface-container-highest text-primary font-label-code text-label-micro border border-primary/30">OPEN POST ↗</a>
            </div>
          `;
        } else {
          // If image present, display large inspect view
          const img = card.querySelector('img');
          if (img) {
            modalMediaFrame.innerHTML = `<img class="w-full max-h-[360px] object-cover contrast-110" src="${img.src}" alt="${title}">`;
          } else {
            modalMediaFrame.innerHTML = `<div class="p-space-lg text-center font-label-code text-outline italic">ARCHIVAL DOCUMENT FACSIMILE RECORD</div>`;
          }
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
      });
    });

    const closeModal = () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      if (modalMediaFrame) modalMediaFrame.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (dismissBtn) dismissBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  })();
