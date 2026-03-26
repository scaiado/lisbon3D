/**
 * Lisbon 3D — Drive Mode UI Controller
 * Connects the visual design system to the game state
 */

class DriveModeUI {
  constructor() {
    this.elements = {};
    this.speedLinesGenerated = false;
    this.init();
  }

  init() {
    this.cacheElements();
    this.generateSpeedLines();
    this.bindEvents();
  }

  cacheElements() {
    this.elements = {
      hud: document.getElementById('drive-hud'),
      speedometer: document.getElementById('speedometer-gauge'),
      speedValue: document.getElementById('speed-value'),
      speedFill: document.getElementById('speed-fill'),
      scorePanel: document.getElementById('score-panel'),
      scoreValue: document.getElementById('score-value'),
      distanceValue: document.getElementById('distance-value'),
      checkpointOverlay: document.getElementById('checkpoint-overlay'),
      checkpointCard: document.getElementById('checkpoint-card'),
      checkpointName: document.getElementById('checkpoint-name'),
      checkpointPoints: document.getElementById('checkpoint-points'),
      viralMoment: document.getElementById('viral-moment'),
      viralEmoji: document.getElementById('viral-emoji'),
      viralTitle: document.getElementById('viral-title'),
      viralSubtitle: document.getElementById('viral-subtitle'),
      milestoneToast: document.getElementById('milestone-toast'),
      milestoneDistance: document.getElementById('milestone-distance'),
      speedLines: document.getElementById('speed-lines'),
      landmarks: {
        1: document.getElementById('landmark-1'),
        2: document.getElementById('landmark-2'),
        3: document.getElementById('landmark-3')
      }
    };
  }

  generateSpeedLines() {
    const container = this.elements.speedLines;
    if (!container || this.speedLinesGenerated) return;

    // Generate 12 speed lines at different angles
    for (let i = 0; i < 12; i++) {
      const line = document.createElement('div');
      line.className = 'speed-line';
      line.style.setProperty('--rotation', `${i * 30}deg`);
      line.style.animationDelay = `${i * 0.066}s`;
      container.appendChild(line);
    }

    this.speedLinesGenerated = true;
  }

  bindEvents() {
    // Listen for drive mode toggle
    document.addEventListener('driveModeChanged', (e) => {
      if (e.detail.active) {
        this.show();
      } else {
        this.hide();
      }
    });

    // Listen for game state updates
    document.addEventListener('gameStateUpdate', (e) => {
      this.update(e.detail);
    });

    // Listen for checkpoint events
    document.addEventListener('checkpointReached', (e) => {
      this.showCheckpoint(e.detail);
    });

    // Listen for viral moments
    document.addEventListener('viralMoment', (e) => {
      this.showViralMoment(e.detail);
    });

    // Listen for milestones
    document.addEventListener('milestoneReached', (e) => {
      this.showMilestone(e.detail);
    });
  }

  show() {
    if (this.elements.hud) {
      this.elements.hud.style.display = 'block';
      this.elements.hud.classList.add('fade-in');
    }
  }

  hide() {
    if (this.elements.hud) {
      this.elements.hud.style.display = 'none';
      this.elements.hud.classList.remove('fade-in');
    }
    this.hideSpeedLines();
  }

  update(state) {
    // Update speedometer
    if (state.speed !== undefined) {
      this.updateSpeedometer(state.speed, state.maxSpeed || 80);
    }

    // Update score
    if (state.score !== undefined) {
      this.updateScore(state.score, state.scoreDelta);
    }

    // Update distance
    if (state.distance !== undefined) {
      this.updateDistance(state.distance);
    }

    // Update speed lines based on speed
    if (state.speed !== undefined) {
      this.updateSpeedLines(state.speed, state.maxSpeed || 80);
    }
  }

  updateSpeedometer(speed, maxSpeed) {
    const speedometer = this.elements.speedometer;
    const valueEl = this.elements.speedValue;
    const fillEl = this.elements.speedFill;

    if (!valueEl || !fillEl) return;

    // Update value text
    valueEl.textContent = Math.round(speed);

    // Update gauge fill
    const percentage = Math.min(speed / maxSpeed, 1);
    const circumference = 283; // 2 * PI * 45
    const offset = circumference - (percentage * circumference * 0.67); // 240 degrees = 2/3 of circle
    fillEl.style.strokeDashoffset = offset;

    // High speed effects
    if (speed > maxSpeed * 0.8) {
      speedometer?.classList.add('high-speed');
    } else {
      speedometer?.classList.remove('high-speed');
    }
  }

  updateScore(score, delta) {
    const scoreEl = this.elements.scoreValue;
    const panelEl = this.elements.scorePanel;

    if (scoreEl) {
      scoreEl.textContent = Math.floor(score).toLocaleString();
    }

    // Animate on score change
    if (delta && delta > 0) {
      panelEl?.classList.add('score-pop');
      setTimeout(() => {
        panelEl?.classList.remove('score-pop');
      }, 300);

      // Create floating score
      this.createFloatingScore(delta, panelEl);
    }
  }

  createFloatingScore(amount, parent) {
    if (!parent) return;

    const floating = document.createElement('div');
    floating.className = 'floating-score';
    floating.textContent = `+${amount}`;
    floating.style.right = '0';
    floating.style.top = '0';
    parent.appendChild(floating);

    setTimeout(() => floating.remove(), 1000);
  }

  updateDistance(distance) {
    const el = this.elements.distanceValue;
    if (el) {
      el.textContent = (distance / 1000).toFixed(1);
    }
  }

  updateSpeedLines(speed, maxSpeed) {
    const lines = this.elements.speedLines;
    if (!lines) return;

    const threshold = maxSpeed * 0.6;
    const intensity = (speed - threshold) / (maxSpeed - threshold);

    if (speed > threshold) {
      lines.classList.add('active');
      lines.style.opacity = Math.min(intensity * 0.8, 0.8);
    } else {
      lines.classList.remove('active');
      lines.style.opacity = 0;
    }
  }

  hideSpeedLines() {
    const lines = this.elements.speedLines;
    if (lines) {
      lines.classList.remove('active');
      lines.style.opacity = 0;
    }
  }

  showCheckpoint(data) {
    const overlay = this.elements.checkpointOverlay;
    const card = this.elements.checkpointCard;
    const nameEl = this.elements.checkpointName;
    const pointsEl = this.elements.checkpointPoints;

    if (!overlay || !card) return;

    // Set content
    if (nameEl) nameEl.textContent = data.name || 'Checkpoint';
    if (pointsEl) pointsEl.textContent = `+${data.points || 500}`;

    // Show overlay
    overlay.style.display = 'flex';
    card.classList.remove('fade-out');

    // Mark landmark as visited on minimap
    const landmarkId = data.landmarkId;
    if (landmarkId && this.elements.landmarks[landmarkId]) {
      this.elements.landmarks[landmarkId].classList.add('visited');
    }

    // Auto hide after delay
    setTimeout(() => {
      card.classList.add('fade-out');
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 400);
    }, 2500);
  }

  showViralMoment(data) {
    const moment = this.elements.viralMoment;
    const emoji = this.elements.viralEmoji;
    const title = this.elements.viralTitle;
    const subtitle = this.elements.viralSubtitle;

    if (!moment) return;

    // Set content
    if (emoji) emoji.textContent = data.emoji || '🎉';
    if (title) title.textContent = data.title || 'Achievement!';
    if (subtitle) subtitle.textContent = data.subtitle || '';

    // Show
    moment.style.display = 'block';

    // Auto hide
    setTimeout(() => {
      moment.style.display = 'none';
    }, 4000);
  }

  showMilestone(data) {
    const toast = this.elements.milestoneToast;
    const distanceEl = this.elements.milestoneDistance;

    if (!toast) return;

    // Set distance
    if (distanceEl) {
      distanceEl.textContent = (data.distance / 1000).toFixed(1);
    }

    // Show
    toast.style.display = 'block';

    // Auto hide
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }

  // Landmark visited status update
  markLandmarkVisited(landmarkId) {
    const landmark = this.elements.landmarks[landmarkId];
    if (landmark) {
      landmark.classList.add('visited');
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.driveModeUI = new DriveModeUI();
});

// Helper function to dispatch game state updates
function updateDriveUI(state) {
  document.dispatchEvent(new CustomEvent('gameStateUpdate', { detail: state }));
}

// Helper function to trigger checkpoint
function triggerCheckpoint(data) {
  document.dispatchEvent(new CustomEvent('checkpointReached', { detail: data }));
}

// Helper function to trigger viral moment
function triggerViralMoment(data) {
  document.dispatchEvent(new CustomEvent('viralMoment', { detail: data }));
}

// Helper function to trigger milestone
function triggerMilestone(data) {
  document.dispatchEvent(new CustomEvent('milestoneReached', { detail: data }));
}
