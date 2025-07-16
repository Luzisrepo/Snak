gsap.registerPlugin(Physics2DPlugin, PhysicsPropsPlugin);

// DOM Elements
const elements = {
  loadingOverlay: document.getElementById("loading-overlay"),
  gameCanvas: document.getElementById("game-canvas"),
  terminalContent: document.getElementById("terminal-content"),
  storyContent: document.getElementById("story-content"),
  particlesContainer: document.getElementById("floating-particles"),
  meteorContainer: document.getElementById("meteor-container"), // For meteors
  catLogoContainer: document.createElement("div"),
  gameOverOverlay: document.getElementById("game-over-overlay"),
  startScreen: document.getElementById("start-screen"),
  startBtn: document.getElementById("start-btn"),
  finalScore: document.getElementById("final-score"),
  restartBtn: document.getElementById("restart-btn"),
  resetBtn: document.getElementById("reset-btn"),
  pauseBtn: document.getElementById("pause-btn"),
  speedSlider: document.getElementById("speed-slider"),
  resolutionSlider: document.getElementById("resolution-slider"),
  burstSlider: document.getElementById("burst-slider"),
  speedValue: document.getElementById("speed-value"),
  resolutionValue: document.getElementById("resolution-value"),
  burstValue: document.getElementById("burst-value"),
  lengthValue: document.getElementById("length-value"),
  scoreValue: document.getElementById("score-value"),
  statusValue: document.getElementById("status-value"),
  levelValue: document.getElementById("level-value"),
  stabilityBar: document.getElementById("stability-bar"),
  timestamp: document.getElementById("timestamp"),
  audioToggle: document.getElementById("audio-toggle"),
  gridOverlay: document.querySelector(".grid-overlay"),
  loadingProgressBar: document.getElementById("loading-progress-bar"),
  musicVolumeSlider: document.getElementById("music-volume-slider"),
  sfxVolumeSlider: document.getElementById("sfx-volume-slider"),
  musicVolumeValue: document.getElementById("music-volume-value"),
  sfxVolumeValue: document.getElementById("sfx-volume-value"),
  pixelRevealContainer: document.getElementById("pixel-reveal-container"),
  catSprite: document.querySelector(".cat-sprite")
};

elements.catLogoContainer.style.position = "fixed";
elements.catLogoContainer.style.top = "0";
elements.catLogoContainer.style.left = "0";
elements.catLogoContainer.style.width = "100%";
elements.catLogoContainer.style.height = "100%";
elements.catLogoContainer.style.pointerEvents = "none";
elements.catLogoContainer.style.zIndex = "90";
document.body.appendChild(elements.catLogoContainer);

const audio = {
  backgroundMusic: document.getElementById("background-music"),
  eatSound: document.getElementById("eat-sound"),
  gameOverSound: document.getElementById("game-over-sound"),
  levelUpSound: document.getElementById("level-up-sound"),
  meteorSound: document.getElementById("meteor-sound"),
  explosionSound: document.getElementById("explosion-sound"),
  gsapSound: document.getElementById("gsap-sound"),
  webflowSound: document.getElementById("webflow-sound")
};

const ctx = elements.gameCanvas.getContext("2d");

let gsapLogoImg = null;
let webflowLogoImg = null;
let gsapPixelArtSrc = null;
let webflowPixelArtSrc = null;
const PIXEL_ART_SIZE = 32;

const gameState = {
  gridSize: 20,
  tileCount: Math.floor(elements.gameCanvas.width / 20),
  snake: [],
  food: {},
  direction: "right",
  nextDirection: "right",
  score: 0,
  logosFound: 0,
  gameSpeed: 150,
  baseSpeed: 1.0,
  gameRunning: false,
  gamePaused: false,
  gameLoop: null,
  burstIntensity: 1.0,
  level: 1,
  collectedWords: [],
  audioEnabled: true,
  meteorInterval: null,
  backgroundMeteorInterval: null,
  catThrowsLogoInterval: null,
  collisionPoint: { x: 0, y: 0 },
  logoRotation: 0,
  tabActive: true,
  activeMeteors: 0,
  currentSnakeColor: "#D3D3D3",
  musicVolume: 0.8,
  sfxVolume: 0.5,
  isShaking: false,
  comboCount: 0,
  lastFoodTime: 0,
  snakeDisintegrating: false,
  // Touch control state
  touchStartX: 0,
  touchStartY: 0,
  touchMoved: false, // Flag to ensure a swipe only counts once per touch interaction
  swipeThreshold: 30 // Minimum pixels to register a swipe
};

const CONSTANTS = {
  MAX_METEORS: 3,
  SPEED_INCREASE_PER_LEVEL: 0.12,
  METEOR_COLORS: {
    core: "#ff9d40",
    outer: "#ffc180",
    trail: "#ffb366",
    flash: "#fff0e0"
  },
  COMBO_TIME_WINDOW: 3000,
  SCREEN_SHAKE_INTENSITY: 16,
  SCREEN_SHAKE_DURATION: 0.9,
  CAT_THROW_INTERVAL_MIN: 5000,
  CAT_THROW_INTERVAL_MAX: 10000
};

let audioContext;
const sfxNodes = {};
const audioBuffers = {};

function initAudioContext() {
  if (!audioContext && (window.AudioContext || window.webkitAudioContext)) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext && audioContext.state === "suspended") {
    audioContext
      .resume()
      .catch((e) => console.warn("AudioContext resume failed:", e));
  }
}
document.body.addEventListener("click", initAudioContext, { once: true });
document.body.addEventListener("keydown", initAudioContext, { once: true });
elements.gameCanvas.addEventListener("touchstart", initAudioContext, {
  once: true
}); // Init on canvas touch too

async function preloadAudioBuffer(audioElement) {
  if (
    !audioContext ||
    !audioElement ||
    !audioElement.src ||
    audioBuffers[audioElement.src]
  ) {
    return;
  }
  try {
    const response = await fetch(audioElement.src);
    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioBuffers[audioElement.src] = decodedBuffer;
  } catch (e) {
    console.error(`Error preloading audio ${audioElement.src}: ${e}`);
  }
}

function preloadAllAudio() {
  if (!audioContext || audioContext.state !== "running") {
    return;
  }
  const soundsToPreload = [
    audio.eatSound,
    audio.explosionSound,
    audio.gameOverSound,
    audio.levelUpSound,
    audio.gsapSound,
    audio.webflowSound
  ];
  soundsToPreload.forEach(preloadAudioBuffer);
}

function playSoundWithPitch(
  audioElement,
  relativeVolume = 1.0,
  pitchMin = 0.9,
  pitchMax = 1.1
) {
  if (!gameState.audioEnabled || !audioElement) return;

  if (audioContext && audioContext.state === "suspended") {
    audioContext
      .resume()
      .catch((e) => console.warn("AudioContext resume failed during play:", e));
  }

  const isWebAudioReady =
    audioContext &&
    audioContext.state === "running" &&
    audioBuffers[audioElement.src];

  if (!isWebAudioReady) {
    if (audioElement.play) {
      audioElement.currentTime = 0;
      audioElement.volume = relativeVolume * gameState.sfxVolume;
      audioElement
        .play()
        .catch((e) =>
          console.warn(`HTMLAudio fallback play error (${audioElement.id}):`, e)
        );
    }
    return;
  }

  if (sfxNodes[audioElement.id]) {
    try {
      sfxNodes[audioElement.id].stop();
      sfxNodes[audioElement.id].disconnect();
    } catch (e) {}
    delete sfxNodes[audioElement.id];
  }

  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  source.buffer = audioBuffers[audioElement.src];
  gainNode.gain.value = relativeVolume * gameState.sfxVolume;
  source.playbackRate.value = Math.random() * (pitchMax - pitchMin) + pitchMin;
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);

  try {
    source.start(0);
    sfxNodes[audioElement.id] = source;
    source.onended = () => {
      if (sfxNodes[audioElement.id] === source)
        delete sfxNodes[audioElement.id];
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch (e) {}
    };
  } catch (e) {
    console.error(`Error starting Web Audio source (${audioElement.id}):`, e);
    if (audioElement.play) {
      audioElement.currentTime = 0;
      audioElement.volume = relativeVolume * gameState.sfxVolume;
      audioElement
        .play()
        .catch((playError) =>
          console.warn(
            `HTMLAudio ultimate fallback error (${audioElement.id}):`,
            playError
          )
        );
    }
  }
}

const storyFragments = [
  "In the digital realm of Webflow-powered creation,Rayzz Is the ultimate goat",
  "Rayzz is tall and handsome.",
  "Rayzz has a cool tinder profile.",
  "and his discord profile is even prettier.",
  "Idk why I'm putting all of this here.",
  "Keep picking up stuff so I can yap more.",
  "Picked up another square huh",
  "Nice job, dem squares keep comin' in!",
  "With each logo consumed, the snake grows stronger.",
  "just as rayzz grows stronger in the gym",
  "Smooth animations",
  "Smooth graphics",
  "This game is incredible",
  "obstacles that must be navigated with precision and skill.",
  "As you guide the snake through the digital grid,",
  "think of the countless times u died cuz ur bad",
  "Learning to combine the power of arrow keys",
  "with some IQ",
  "and win the fawkin game",
  "Noice",
  "Epic",
  "Legendary",
  "Dude theres nthin better than legendary",
  "STOP PICKING UP SQUARES",
  "MY SQUAREZZZ",
  "Lil Tecca on the beat",
  "Idk",
  "Ur almost there!!!!!",
  "SO closeeee",
  "2 more to go",
  "WEEEwooooWEEE",
  "U WON BITCH!."
];

function triggerScreenShake(
  intensity = 1,
  duration = CONSTANTS.SCREEN_SHAKE_DURATION
) {
  if (gameState.isShaking) return;
  gameState.isShaking = true;
  const canvas = elements.gameCanvas;
  const container = canvas.parentElement || document.body;
  gsap.killTweensOf(canvas, "x,y,rotation");
  gsap.killTweensOf(container, "scale");

  const shakeValues = [];
  const frames = Math.floor(duration * 60);

  for (let i = 0; i < frames; i++) {
    const progress = i / frames;
    let currentIntensity;
    let currentScaleIntensity;

    if (progress < 0.15) {
      currentIntensity = CONSTANTS.SCREEN_SHAKE_INTENSITY * intensity;
      currentScaleIntensity = 0.025 * intensity;
    } else {
      currentIntensity =
        CONSTANTS.SCREEN_SHAKE_INTENSITY *
        intensity *
        (1 - (progress - 0.15) / 0.85) *
        (0.6 + Math.abs(Math.sin(progress * Math.PI * 8)));
      currentScaleIntensity =
        0.015 *
        intensity *
        (1 - (progress - 0.15) / 0.85) *
        (0.5 + Math.abs(Math.cos(progress * Math.PI * 6)));
    }

    const x = Math.round(((Math.random() - 0.5) * currentIntensity) / 4) * 4;
    const y = Math.round(((Math.random() - 0.5) * currentIntensity) / 4) * 4;
    shakeValues.push({ x, y, scale: 1 + currentScaleIntensity });
  }

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.to(canvas, { x: 0, y: 0, duration: 0.15, ease: "power1.out" });
      gsap.to(container, { scale: 1, duration: 0.15, ease: "power1.out" });
      gameState.isShaking = false;
    }
  });

  shakeValues.forEach((shake, index) => {
    tl.to(
      canvas,
      { x: shake.x, y: shake.y, duration: 1 / 60, ease: "none" },
      index * (1 / 60)
    );
    tl.to(
      container,
      { scale: shake.scale, duration: 1 / 60, ease: "none" },
      index * (1 / 60)
    );
  });
  createShakeParticles(intensity * 1.2);
}

function createShakeParticles(intensityMultiplier = 1) {
  const canvasRect = elements.gameCanvas.getBoundingClientRect();
  const centerX = canvasRect.left + canvasRect.width / 2;
  const centerY = canvasRect.top + canvasRect.height / 2;
  const particleCount = Math.floor(10 * intensityMultiplier);

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    Object.assign(particle.style, {
      position: "fixed",
      width: `${Math.random() * 3 + 2}px`,
      height: `${Math.random() * 3 + 2}px`,
      backgroundColor: `hsl(${Math.random() * 30 + 0}, 100%, ${
        60 + Math.random() * 15
      }%)`,
      borderRadius: "0",
      pointerEvents: "none",
      zIndex: "999"
    });
    elements.particlesContainer.appendChild(particle);
    gsap.set(particle, { x: centerX, y: centerY });
    gsap.to(particle, {
      duration: 0.45 + Math.random() * 0.25,
      x: centerX + gsap.utils.random(-90, 90) * intensityMultiplier * 0.75,
      y: centerY + gsap.utils.random(-90, 90) * intensityMultiplier * 0.75,
      opacity: 0,
      scale: Math.random() * 0.5,
      ease: "power1.out",
      onComplete: () =>
        elements.particlesContainer.contains(particle) &&
        elements.particlesContainer.removeChild(particle)
    });
  }
}

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex]
    ];
  }
  return array;
}

function createPixelRevealGrid() {
  elements.pixelRevealContainer.innerHTML = "";
  const { innerWidth, innerHeight } = window;
  const blockSize = innerHeight * 0.1;
  const numRows = 10;
  const numCols = Math.ceil(innerWidth / blockSize);
  for (let i = 0; i < numRows; i++) {
    const row = document.createElement("div");
    row.className = "pixel-reveal-row";
    for (let j = 0; j < numCols; j++) {
      const block = document.createElement("div");
      block.className = "pixel-reveal-block";
      block.style.opacity = "1";
      row.appendChild(block);
    }
    elements.pixelRevealContainer.appendChild(row);
  }
}

function animatePixelReveal() {
  const rows = document.querySelectorAll(".pixel-reveal-row");
  const tl = gsap.timeline({
    onComplete: () => {
      gsap.to(elements.pixelRevealContainer, {
        autoAlpha: 0,
        duration: 0.5,
        onComplete: () => (elements.pixelRevealContainer.style.display = "none")
      });
    }
  });
  const rowBlocks = [];
  rows.forEach((row) => {
    rowBlocks.push(Array.from(row.querySelectorAll(".pixel-reveal-block")));
  });
  rowBlocks.forEach((blocks, rowIndex) => {
    const shuffledBlocks = shuffle([...blocks]);
    shuffledBlocks.forEach((block, blockIndex) => {
      tl.to(
        block,
        {
          opacity: 0,
          duration: 0.1,
          delay: 0.02 * (rowIndex + blockIndex),
          ease: "power1.out"
        },
        0
      );
    });
  });
  return tl;
}

function createImageFromSVG(svgString, type, callback) {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);

    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = PIXEL_ART_SIZE;
    offscreenCanvas.height = PIXEL_ART_SIZE;
    const offCtx = offscreenCanvas.getContext("2d");
    offCtx.imageSmoothingEnabled = false;
    offCtx.drawImage(img, 0, 0, PIXEL_ART_SIZE, PIXEL_ART_SIZE);
    const pixelatedDataURL = offscreenCanvas.toDataURL();

    if (type === "gsap") {
      gsapLogoImg = img;
      gsapPixelArtSrc = pixelatedDataURL;
    } else if (type === "webflow") {
      webflowLogoImg = img;
      webflowPixelArtSrc = pixelatedDataURL;
    }
    callback(img);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    console.error(`Failed to load SVG logo: ${type}`);
    callback(null);
  };
  img.src = url;
}

function initializeLogos() {
  const gsapSVG = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" fill="#0AE448"/><g><path d="M9.71097 16.1381V16.1429L9.31768 17.8534C9.29646 17.9502 9.19987 18.0213 9.08865 18.0213H8.61341C8.59632 18.0214 8.57971 18.0269 8.56601 18.0371C8.55231 18.0474 8.54225 18.0617 8.53731 18.0781C8.09902 19.5683 7.5056 20.5927 6.72194 21.2076C6.05536 21.7312 5.23365 21.9751 4.13573 21.9751C3.14938 21.9751 2.48426 21.6572 1.92012 21.0298C1.17487 20.1997 0.866823 18.8423 1.05341 17.2062C1.38963 14.1346 2.97926 11.0352 6.03999 11.0352C6.97109 11.0268 7.70207 11.3146 8.2106 11.8895C8.74841 12.4971 9.02134 13.4127 9.0228 14.6106C9.02146 14.6631 8.99973 14.713 8.96221 14.7497C8.9247 14.7864 8.87437 14.807 8.82194 14.8071H6.57926C6.53996 14.8059 6.50262 14.7896 6.47492 14.7617C6.44723 14.7337 6.43128 14.6962 6.43036 14.6568C6.41207 13.8285 6.16694 13.4248 5.67963 13.4248C4.81987 13.4248 4.3128 14.5944 4.0439 15.2431C3.66816 16.1487 3.47682 17.1321 3.51451 18.1119C3.53243 18.568 3.6056 19.2097 4.03768 19.4751C4.42073 19.7109 4.96731 19.5547 5.29841 19.2936C5.62914 19.0329 5.89548 18.5816 6.00743 18.1698C6.02316 18.1126 6.02426 18.0682 6.00926 18.0481C5.99353 18.0279 5.94999 18.0231 5.9167 18.0231H5.34085C5.31037 18.0232 5.28023 18.0166 5.25255 18.0039C5.22488 17.9911 5.20032 17.9724 5.1806 17.9491C5.16547 17.9309 5.15473 17.9094 5.14921 17.8864C5.14369 17.8634 5.14354 17.8394 5.14877 17.8163L5.54243 16.1025C5.56182 16.0145 5.64121 15.9485 5.7389 15.9364V15.9324H9.51816C9.52694 15.9324 9.53609 15.9324 9.54451 15.9342C9.64255 15.9467 9.7117 16.0384 9.70987 16.1381H9.71097Z" fill="black"/><path d="M16.2173 14.1717C16.2157 14.2239 16.1939 14.2734 16.1564 14.3097C16.119 14.3461 16.0689 14.3664 16.0168 14.3664H13.9512C13.8158 14.3664 13.7028 14.2564 13.7028 14.1225C13.7028 13.5183 13.4943 13.2242 13.0677 13.2242C12.6411 13.2242 12.366 13.4871 12.3579 13.9458C12.3488 14.4573 12.6374 14.9219 13.4591 15.7205C14.541 16.7376 14.9745 17.6389 14.9537 18.8298C14.9196 20.7552 13.6132 22 11.6251 22C10.6099 22 9.83426 21.7276 9.31841 21.1908C8.79487 20.6459 8.55487 19.8458 8.60499 18.8129C8.60671 18.7607 8.62863 18.7112 8.66613 18.675C8.70362 18.6387 8.75373 18.6185 8.80585 18.6186H10.9424C10.9722 18.6191 11.0015 18.6263 11.0282 18.6395C11.0549 18.6528 11.0784 18.6718 11.0968 18.6952C11.113 18.7146 11.1248 18.7371 11.1315 18.7614C11.1382 18.7857 11.1396 18.8112 11.1356 18.836C11.1118 19.2086 11.1766 19.4869 11.3229 19.6409C11.4166 19.7406 11.5472 19.7912 11.71 19.7912C12.1048 19.7912 12.336 19.5114 12.3448 19.0249C12.3521 18.6039 12.2193 18.2347 11.4956 17.4885C10.5608 16.5733 9.72268 15.6277 9.74865 14.1409C9.76402 13.2788 10.1057 12.4901 10.7112 11.9203C11.3515 11.3183 12.2269 11 13.2433 11C14.2615 11.0073 15.033 11.2981 15.5368 11.865C16.0139 12.4025 16.2437 13.1784 16.218 14.1713L16.2173 14.1717Z" fill="black"/><path d="M22.6205 21.6377L22.634 11.396C22.6344 11.3704 22.6297 11.3449 22.6201 11.3211C22.6106 11.2973 22.5963 11.2757 22.5783 11.2575C22.5603 11.2393 22.5388 11.2248 22.5151 11.2151C22.4915 11.2053 22.4661 11.2004 22.4405 11.2006H19.2437C19.1361 11.2006 19.0889 11.293 19.0582 11.3546L14.4294 21.5754V21.5772L14.4276 21.5794C14.3763 21.7052 14.4737 21.8398 14.6094 21.8398H16.844C16.9648 21.8398 17.0445 21.8031 17.084 21.7268L17.5278 20.658C17.5823 20.5157 17.5926 20.5025 17.7477 20.5025H19.8828C20.0313 20.5025 20.0346 20.5055 20.0321 20.651L19.9842 21.6447C19.9838 21.6703 19.9886 21.6957 19.9982 21.7195C20.0078 21.7432 20.022 21.7648 20.04 21.783C20.058 21.8012 20.0795 21.8156 20.1031 21.8253C20.1268 21.835 20.1521 21.84 20.1777 21.8398H22.435C22.463 21.8401 22.4907 21.8344 22.5161 21.8228C22.5416 21.8113 22.5642 21.7943 22.5824 21.773C22.5982 21.7546 22.6097 21.7329 22.6163 21.7096C22.6228 21.6862 22.6243 21.6617 22.6205 21.6377Z" fill="black"/><path d="M27.175 11.2006H25.4778C25.3882 11.2006 25.2876 11.2482 25.2638 11.3553L22.9022 21.6326C22.897 21.6558 22.8972 21.68 22.9028 21.7031C22.9083 21.7262 22.9192 21.7478 22.9344 21.7661C22.9541 21.7893 22.9786 21.808 23.0062 21.8208C23.0338 21.8336 23.0639 21.8402 23.0943 21.8401H25.2155C25.3293 21.8401 25.4076 21.784 25.4288 21.6869C25.4288 21.6869 25.686 20.5253 25.6863 20.5216C25.7046 20.431 25.6732 20.3606 25.592 20.3181C25.5535 20.2983 25.5155 20.2785 25.4778 20.2583L25.1101 20.0669L24.7443 19.8755L24.6027 19.8018C24.5912 19.796 24.5817 19.7871 24.575 19.7761C24.5684 19.765 24.5651 19.7524 24.5654 19.7395C24.5658 19.7205 24.5737 19.7025 24.5872 19.6892C24.6007 19.6759 24.6189 19.6685 24.6378 19.6684L25.8005 19.6735C26.1481 19.6753 26.496 19.6508 26.8381 19.5877C29.2454 19.1422 30.8441 17.2099 30.8902 14.5805C30.9294 12.3365 29.6796 11.1995 27.1768 11.1995L27.175 11.2006Z" fill="black"/></g></svg>`;
  const webflowSVG = `<svg width="32" height="32" viewBox="0 0 1080 1080" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="1080" height="1080" fill="#146EF5"/><path fill-rule="evenodd" clip-rule="evenodd" d="M898.312 337.5L683.467 757.5H481.667L571.579 583.434H567.545C493.368 679.726 382.694 743.115 225 757.5V585.843C225 585.843 325.88 579.884 385.185 517.534H225V337.503H405.031V485.576L409.072 485.559L482.639 337.503H618.791V484.637L622.832 484.631L699.159 337.5H898.312Z" fill="white"/></svg>`;

  createImageFromSVG(gsapSVG, "gsap", (img) => {
    /* Original image stored in gsapLogoImg */
  });
  createImageFromSVG(webflowSVG, "webflow", (img) => {
    /* Original image stored in webflowLogoImg */
  });
}

document.addEventListener("visibilitychange", function () {
  gameState.tabActive = !document.hidden;
  if (!gameState.tabActive) {
    clearInterval(gameState.meteorInterval);
    clearInterval(gameState.backgroundMeteorInterval);
    clearInterval(gameState.catThrowsLogoInterval);
    if (audioContext && audioContext.state === "running")
      audioContext
        .suspend()
        .catch((e) => console.warn("AudioContext suspend on blur failed:", e));
  } else {
    if (audioContext && audioContext.state === "suspended")
      audioContext
        .resume()
        .catch((e) => console.warn("AudioContext resume on focus failed:", e));
    if (gameState.gameRunning && !gameState.gamePaused) {
      startMeteorSpawning();
      startBackgroundMeteorShower();
      startCatLogoThrowing();
    }
  }
});

function getRandomBrightColor() {
  const pixelColors = ["#FFFF00", "#40E0D0", "#FFFFFF", "#FF69B4", "#32CD32"];
  return pixelColors[Math.floor(Math.random() * pixelColors.length)];
}

function clearAllMeteors() {
  elements.meteorContainer.innerHTML = "";
  gameState.activeMeteors = 0;
  document
    .querySelectorAll(".meteor, .meteor-trail")
    .forEach((meteor) => meteor.remove());
}

function updateGridOverlay() {
  if (!elements.gridOverlay) return;
  const gameCanvasRect = elements.gameCanvas.getBoundingClientRect();
  const bodyRect = document.body.getBoundingClientRect();
  Object.assign(elements.gridOverlay.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    backgroundSize: `${gameState.gridSize}px ${gameState.gridSize}px`,
    backgroundPosition: `${gameCanvasRect.left - bodyRect.left}px ${
      gameCanvasRect.top - bodyRect.top
    }px`
  });
}

function initLoading() {
  initAudioContext();
  createPixelRevealGrid();
  let progress = 0;
  function updateLoading() {
    progress += Math.random() * 4 + 1;
    elements.loadingProgressBar.style.width = Math.min(progress, 100) + "%";
    if (progress <= 100) {
      setTimeout(updateLoading, 60);
    } else {
      setTimeout(() => {
        gsap.to(elements.loadingOverlay, {
          opacity: 0,
          duration: 1,
          ease: "power2.out",
          onComplete: () => {
            elements.loadingOverlay.style.display = "none";
            animatePixelReveal().then(() => setupGame());
          }
        });
      }, 500);
    }
  }
  updateLoading();
}

function resetMeteorContainer() {
  clearAllMeteors();
  Object.assign(elements.meteorContainer.style, {
    display: "block",
    zIndex: "2"
  });
}

function setupGame() {
  initializeLogos();
  resetMeteorContainer();
  Object.assign(gameState, {
    gridSize: parseInt(elements.resolutionSlider.value),
    snake: [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 }
    ],
    direction: "right",
    nextDirection: "right",
    score: 0,
    logosFound: 0,
    level: 1,
    baseSpeed: 1.0,
    gameRunning: false,
    gamePaused: false,
    collectedWords: [],
    logoRotation: 0,
    currentSnakeColor: "#D3D3D3",
    comboCount: 0,
    lastFoodTime: 0,
    isShaking: false,
    snakeDisintegrating: false
  });
  gameState.tileCount = Math.floor(
    elements.gameCanvas.width / gameState.gridSize
  );
  gameState.gameSpeed = 150 / gameState.baseSpeed;
  [
    gameState.meteorInterval,
    gameState.backgroundMeteorInterval,
    gameState.gameLoop,
    gameState.catThrowsLogoInterval
  ].forEach(clearInterval);
  gsap.killTweensOf(elements.gameCanvas);
  gsap.killTweensOf(elements.gameCanvas.parentElement || document.body);
  gsap.set(elements.gameCanvas, { x: 0, y: 0, rotation: 0 });
  gsap.set(elements.gameCanvas.parentElement || document.body, { scale: 1 });
  updateGridOverlay();

  if (audioContext && audioContext.state === "running") {
    preloadAllAudio();
  } else {
    setTimeout(() => {
      if (audioContext && audioContext.state === "running") preloadAllAudio();
    }, 1000);
  }

  elements.musicVolumeValue.textContent = gameState.musicVolume.toFixed(1);
  elements.sfxVolumeValue.textContent = gameState.sfxVolume.toFixed(1);
  elements.musicVolumeSlider.value = gameState.musicVolume;
  elements.sfxVolumeSlider.value = gameState.sfxVolume;
  elements.speedSlider.value = gameState.baseSpeed;
  elements.speedValue.textContent = gameState.baseSpeed.toFixed(1);
  elements.lengthValue.textContent = gameState.snake.length;
  elements.scoreValue.textContent = gameState.logosFound;
  elements.levelValue.textContent = gameState.level;
  elements.statusValue.textContent = "AWAITING_SEQUENCE";
  elements.pauseBtn.textContent = "PAUSE";
  elements.stabilityBar.style.width = "75%";
  elements.storyContent.innerHTML =
    "<p>The void awaits your first move. Create. Animate.</p>";
  elements.particlesContainer.innerHTML = "";
  elements.catLogoContainer.innerHTML = "";
  clearAllMeteors();
  Object.assign(elements.gameOverOverlay.style, {
    opacity: "0",
    pointerEvents: "none"
  });
  elements.startScreen.style.display = "flex";
  placeFood();
  draw();
  updateClock();
  if (gameState.tabActive) startBackgroundMeteorShower();
}

function startGame() {
  initAudioContext();
  if (audioContext && audioContext.state === "suspended") {
    audioContext
      .resume()
      .catch((e) => console.warn("AudioContext resume on start failed:", e));
  }
  if (audioContext && audioContext.state === "running") {
    preloadAllAudio();
  }

  gameState.gameRunning = true;
  gameState.snakeDisintegrating = false;
  elements.startScreen.style.display = "none";
  clearInterval(gameState.gameLoop);
  gameState.gameLoop = setInterval(updateGame, gameState.gameSpeed);
  addTerminalLine("GSAP_Physics2D_Online :: WF-Grid_Rendered", "system_init");
  gameState.audioEnabled = true;
  elements.audioToggle.textContent = "🔊";
  audio.backgroundMusic.volume = gameState.musicVolume;
  audio.backgroundMusic
    .play()
    .catch((e) => console.warn("Audio autoplay prevented:", e));
  elements.statusValue.textContent = "STREAM_ACTIVE";
  if (gameState.tabActive) {
    startMeteorSpawning();
    startBackgroundMeteorShower();
    startCatLogoThrowing();
  }
  gsap.from(elements.gameCanvas, {
    scale: 0.8,
    opacity: 0,
    duration: 1,
    ease: "back.out(1.7)"
  });
}

function placeFood() {
  const isSpecial = (gameState.score + 1) % 8 === 0;
  const isGsap = (gameState.score + 1) % 16 === 0;
  gameState.food = {
    x: Math.floor(Math.random() * (gameState.tileCount - 2)) + 1,
    y: Math.floor(Math.random() * (gameState.tileCount - 2)) + 1,
    type: isSpecial ? (isGsap ? "gsap" : "webflow") : "pixel",
    color: isSpecial ? null : getRandomBrightColor()
  };
  for (let i = 0; i < gameState.snake.length; i++) {
    if (
      gameState.snake[i].x === gameState.food.x &&
      gameState.snake[i].y === gameState.food.y
    ) {
      placeFood();
      return;
    }
  }
  let messageType = "data_spawn";
  let message = `Data_Fragment_Detected :: Coords (${gameState.food.x},${gameState.food.y})`;
  if (gameState.food.type === "gsap") {
    message = `GSAP_Node_Manifested :: Motion_Core_Signal @ (${gameState.food.x},${gameState.food.y})`;
    messageType = "gsap_spawn";
  } else if (gameState.food.type === "webflow") {
    message = `WF_Constructor_Active :: Design_Matrix_Signal @ (${gameState.food.x},${gameState.food.y})`;
    messageType = "webflow_spawn";
  }
  addTerminalLine(message, messageType);
  createFoodSpawnEffect();
}

function createFoodSpawnEffect() {
  const foodCenterX =
    gameState.food.x * gameState.gridSize + gameState.gridSize / 2;
  const foodCenterY =
    gameState.food.y * gameState.gridSize + gameState.gridSize / 2;
  const canvasRect = elements.gameCanvas.getBoundingClientRect();
  const worldX = canvasRect.left + foodCenterX;
  const worldY = canvasRect.top + foodCenterY;
  const particleColor =
    gameState.food.type === "pixel"
      ? gameState.food.color
      : gameState.food.type === "gsap"
      ? "#0AE448"
      : "#146EF5";

  for (let i = 0; i < 8; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    Object.assign(particle.style, {
      position: "fixed",
      backgroundColor: particleColor,
      width: "2px",
      height: "2px",
      borderRadius: "0",
      pointerEvents: "none",
      zIndex: "100"
    });
    elements.particlesContainer.appendChild(particle);
    gsap.set(particle, { x: worldX, y: worldY, scale: 0 });
    gsap.to(particle, {
      duration: 0.6,
      scale: 1.0,
      physics2D: {
        velocity: Math.random() * 50 + 25,
        angle: (360 / 8) * i,
        gravity: 60
      },
      opacity: 0,
      ease: "power1.out",
      onComplete: () =>
        elements.particlesContainer.contains(particle) &&
        elements.particlesContainer.removeChild(particle)
    });
  }
}

function updateGame() {
  if (!gameState.gameRunning || gameState.gamePaused) return;
  gameState.direction = gameState.nextDirection;
  const head = { ...gameState.snake[0] };
  const moves = {
    up: () => head.y--,
    down: () => head.y++,
    left: () => head.x--,
    right: () => head.x++
  };
  moves[gameState.direction]();
  if (
    head.x < 0 ||
    head.x >= gameState.tileCount ||
    head.y < 0 ||
    head.y >= gameState.tileCount ||
    checkSnakeCollision(head)
  ) {
    gameState.collisionPoint = head;
    gameOver();
    return;
  }
  if (head.x === gameState.food.x && head.y === gameState.food.y) {
    gameState.snake.unshift(head);
    const foodCenterX =
      gameState.food.x * gameState.gridSize + gameState.gridSize / 2;
    const foodCenterY =
      gameState.food.y * gameState.gridSize + gameState.gridSize / 2;
    const currentTime = Date.now();
    if (currentTime - gameState.lastFoodTime < CONSTANTS.COMBO_TIME_WINDOW)
      gameState.comboCount++;
    else gameState.comboCount = 1;
    gameState.lastFoodTime = currentTime;

    let terminalMessageType = "food_eat_pixel";
    let terminalMessageText = `Data_Absorbed :: Energy_Signature_Nominal`;

    if (gameState.food.type === "gsap" || gameState.food.type === "webflow") {
      gameState.logosFound++;
      elements.scoreValue.textContent = gameState.logosFound;
      const config =
        gameState.food.type === "gsap"
          ? {
              color: "#0AE448",
              sound: audio.gsapSound,
              colors: ["#0AE448", "#ffffff", "#b3ff00", "#32ff7e"]
            }
          : {
              color: "#146EF5",
              sound: audio.webflowSound,
              colors: ["#146EF5", "#ffffff", "#a0c8ff", "#3742fa"]
            };
      gameState.currentSnakeColor = config.color;
      createEnhancedBurst(
        foodCenterX,
        foodCenterY,
        config.colors,
        gameState.food.type
      );
      playSoundWithPitch(config.sound, 1.0);
      terminalMessageType =
        gameState.food.type === "gsap" ? "gsap_eat" : "webflow_eat";
      terminalMessageText =
        gameState.food.type === "gsap"
          ? "GSAP_Core_Integrated :: Physics_Module_Enhanced"
          : "WF_Blueprint_Assimilated :: Structure_Matrix_Optimized";
    } else {
      createEnhancedBurst(
        foodCenterX,
        foodCenterY,
        [gameState.food.color, "#ffffff", "#dddddd"],
        "pixel"
      );
      playSoundWithPitch(audio.eatSound, 1.0, 0.95, 1.05);
    }
    if (gameState.score < storyFragments.length) {
      const newWord = storyFragments[gameState.score];
      gameState.collectedWords.push(newWord);
      updateStory();
      createEnhancedScorePopup(foodCenterX, foodCenterY, newWord);
    }
    gameState.score++;
    elements.lengthValue.textContent = gameState.snake.length;
    if (gameState.score % 4 === 0) {
      gameState.level++;
      elements.levelValue.textContent = gameState.level;
      gameState.baseSpeed += CONSTANTS.SPEED_INCREASE_PER_LEVEL;
      elements.speedSlider.value = gameState.baseSpeed;
      elements.speedValue.textContent = gameState.baseSpeed.toFixed(1);
      gameState.gameSpeed = 150 / gameState.baseSpeed;
      clearInterval(gameState.gameLoop);
      gameState.gameLoop = setInterval(updateGame, gameState.gameSpeed);
      addTerminalLine(
        `Quantum_Leap_Successful :: Entity_Lvl_${
          gameState.level
        } :: Velocity_Coefficient_${gameState.baseSpeed.toFixed(2)}`,
        "level_up"
      );
      playSoundWithPitch(audio.levelUpSound, 0.9);
      createLevelUpEffect();
    }
    const stability = Math.max(15, 100 - gameState.snake.length * 1.5);
    elements.stabilityBar.style.width = stability + "%";
    const comboText =
      gameState.comboCount > 1 ? ` :: FlowState_x${gameState.comboCount}` : "";
    addTerminalLine(`${terminalMessageText}${comboText}`, terminalMessageType);
    placeFood();
  } else {
    gameState.snake.pop();
    gameState.snake.unshift(head);
  }
  draw();
}

function createLevelUpEffect() {
  gsap.to([elements.levelValue, elements.speedValue], {
    scale: 1.5,
    color: "#0AE448",
    duration: 0.3,
    yoyo: true,
    repeat: 1,
    ease: "power2.inOut"
  });
  const originalBorder = elements.gameCanvas.style.border;
  elements.gameCanvas.style.border = "3px solid #0AE448";
  setTimeout(() => {
    elements.gameCanvas.style.border = originalBorder;
  }, 500);
}

function checkSnakeCollision(head) {
  return gameState.snake
    .slice(1)
    .some((segment) => head.x === segment.x && head.y === segment.y);
}

function drawRoundedRect(x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, elements.gameCanvas.width, elements.gameCanvas.height);
  ctx.strokeStyle = "rgba(79, 156, 255, 0.3)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= gameState.tileCount; i++) {
    ctx.beginPath();
    ctx.moveTo(i * gameState.gridSize, 0);
    ctx.lineTo(i * gameState.gridSize, elements.gameCanvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * gameState.gridSize);
    ctx.lineTo(elements.gameCanvas.width, i * gameState.gridSize);
    ctx.stroke();
  }
  const food = gameState.food;
  const foodX = food.x * gameState.gridSize,
    foodY = food.y * gameState.gridSize;

  if (food.type === "gsap" && gsapLogoImg) {
    ctx.drawImage(
      gsapLogoImg,
      foodX,
      foodY,
      gameState.gridSize,
      gameState.gridSize
    );
  } else if (food.type === "webflow" && webflowLogoImg) {
    ctx.drawImage(
      webflowLogoImg,
      foodX,
      foodY,
      gameState.gridSize,
      gameState.gridSize
    );
  } else {
    // Pixel food - Square
    ctx.fillStyle = food.color || getRandomBrightColor();
    ctx.fillRect(foodX, foodY, gameState.gridSize, gameState.gridSize);
  }

  if (gameState.snakeDisintegrating) return;

  const cornerRadius =
    gameState.currentSnakeColor === "#0AE448" ? gameState.gridSize / 3.5 : 0;

  gameState.snake.forEach((segment, i) => {
    const alpha = i === 0 ? 1 : Math.max(0.4, 1 - i * 0.04);
    const segmentX = segment.x * gameState.gridSize,
      segmentY = segment.y * gameState.gridSize;

    let fillStyleColor = gameState.currentSnakeColor;
    if (i !== 0) {
      if (fillStyleColor === "#0AE448")
        fillStyleColor = `rgba(10, 228, 72, ${alpha})`;
      else if (fillStyleColor === "#146EF5")
        fillStyleColor = `rgba(20, 110, 245, ${alpha})`;
      else fillStyleColor = `rgba(211, 211, 211, ${alpha})`;
    }

    if (cornerRadius > 0 && gameState.currentSnakeColor === "#0AE448") {
      drawRoundedRect(
        segmentX,
        segmentY,
        gameState.gridSize,
        gameState.gridSize,
        cornerRadius,
        fillStyleColor
      );
    } else {
      ctx.fillStyle = fillStyleColor;
      ctx.fillRect(segmentX, segmentY, gameState.gridSize, gameState.gridSize);
    }

    if (i === 0) {
      // Head
      ctx.fillStyle = "#ffffff";
      const eyeSizeBase = Math.max(2.5, gameState.gridSize / 7.5);
      const time = Date.now() * 0.008;
      const blinkAmount = Math.sin(time * 0.5) > 0.9 ? 0.2 : 1;
      const eyeHeight = eyeSizeBase * blinkAmount;
      let eyeWidth = eyeSizeBase;

      if (cornerRadius > 0 && gameState.currentSnakeColor === "#0AE448") {
        eyeWidth *= 0.9;
      }

      const eyeOffsetFactor = cornerRadius > 0 ? 0.35 : 0.25;

      const eyePositions = {
        right: [
          segmentX +
            gameState.gridSize -
            eyeWidth -
            gameState.gridSize * eyeOffsetFactor,
          segmentY + gameState.gridSize * eyeOffsetFactor,
          segmentX +
            gameState.gridSize -
            eyeWidth -
            gameState.gridSize * eyeOffsetFactor,
          segmentY +
            gameState.gridSize -
            eyeHeight -
            gameState.gridSize * eyeOffsetFactor
        ],
        left: [
          segmentX + gameState.gridSize * eyeOffsetFactor,
          segmentY + gameState.gridSize * eyeOffsetFactor,
          segmentX + gameState.gridSize * eyeOffsetFactor,
          segmentY +
            gameState.gridSize -
            eyeHeight -
            gameState.gridSize * eyeOffsetFactor
        ],
        up: [
          segmentX + gameState.gridSize * eyeOffsetFactor,
          segmentY + gameState.gridSize * eyeOffsetFactor,
          segmentX +
            gameState.gridSize -
            eyeWidth -
            gameState.gridSize * eyeOffsetFactor,
          segmentY + gameState.gridSize * eyeOffsetFactor
        ],
        down: [
          segmentX + gameState.gridSize * eyeOffsetFactor,
          segmentY +
            gameState.gridSize -
            eyeHeight -
            gameState.gridSize * eyeOffsetFactor,
          segmentX +
            gameState.gridSize -
            eyeWidth -
            gameState.gridSize * eyeOffsetFactor,
          segmentY +
            gameState.gridSize -
            eyeHeight -
            gameState.gridSize * eyeOffsetFactor
        ]
      };
      const [x1, y1, x2, y2] = eyePositions[gameState.direction];
      ctx.fillRect(x1, y1, eyeWidth, eyeHeight);
      ctx.fillRect(x2, y2, eyeWidth, eyeHeight);
    }
  });
}

function createEnhancedBurst(x, y, colors, type = "pixel") {
  const canvasRect = elements.gameCanvas.getBoundingClientRect();
  const particleCount = Math.floor(
    (25 + gameState.comboCount * 9) * gameState.burstIntensity
  );
  const worldX = canvasRect.left + x,
    worldY = canvasRect.top + y;
  const configs = {
    gsap: {
      duration: 2.4 + gameState.comboCount * 0.28,
      ease: "elastic.out(1.0, 0.4)",
      rotation: true,
      borderRadius: "0",
      velocityMultiplier: 1.2
    },
    webflow: {
      duration: 2.7 + gameState.comboCount * 0.28,
      ease: "back.out(2.8)",
      rotation: false,
      borderRadius: "50%",
      velocityMultiplier: 1.0
    },
    pixel: {
      duration: 2.0,
      ease: "power2.out",
      rotation: false,
      borderRadius: "0",
      velocityMultiplier: 1.0
    }
  };
  const config = configs[type] || configs.pixel;
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    const size = Math.random() * 9 + 6;
    Object.assign(particle.style, {
      position: "fixed",
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      width: size + "px",
      height: size + "px",
      borderRadius: config.borderRadius,
      pointerEvents: "none",
      zIndex: "100"
    });
    elements.particlesContainer.appendChild(particle);
    gsap.set(particle, {
      x: worldX,
      y: worldY,
      scale: Math.random() * 1.3 + 0.7
    });
    const animationProps = {
      duration: config.duration + Math.random() * 0.5,
      physics2D: {
        velocity:
          (Math.random() * 260 + 100) *
          config.velocityMultiplier *
          gameState.burstIntensity *
          (1 + gameState.comboCount * 0.2),
        angle: Math.random() * 360,
        gravity: type === "gsap" ? 300 : type === "webflow" ? 100 : 240,
        friction: type === "gsap" ? 0.025 : type === "webflow" ? 0.009 : 0.035
      },
      opacity: 0,
      scale: 0,
      ease: config.ease,
      onComplete: () =>
        elements.particlesContainer.contains(particle) &&
        elements.particlesContainer.removeChild(particle)
    };
    if (config.rotation) animationProps.rotation = Math.random() * 700 - 350;
    gsap.to(particle, animationProps);
  }
}

function createEnhancedScorePopup(x, y, word) {
  const canvasRect = elements.gameCanvas.getBoundingClientRect();
  const popup = document.createElement("div");
  popup.className = "score-popup";
  popup.textContent = word;

  let textColor = "#FFFFFF";
  if (gameState.currentSnakeColor === "#0AE448") textColor = "#0AE448";
  else if (gameState.currentSnakeColor === "#146EF5") textColor = "#146EF5";

  Object.assign(popup.style, {
    position: "fixed",
    fontSize: 16 + gameState.comboCount * 2 + "px",
    fontWeight: "bold",
    color: textColor,
    textShadow: `1px 1px 2px rgba(0,0,0,0.6)`,
    pointerEvents: "none",
    zIndex: "200",
    visibility: "hidden",
    padding: "5px",
    whiteSpace: "normal"
  });
  document.body.appendChild(popup);

  let popupX = canvasRect.left + x - popup.offsetWidth / 2;
  let popupY = canvasRect.top + y - popup.offsetHeight - 10;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (popupX < 0) popupX = 5;
  else if (popupX + popup.offsetWidth > viewportWidth)
    popupX = viewportWidth - popup.offsetWidth - 5;

  if (popupY < 0) popupY = 5;
  if (popupY + popup.offsetHeight > viewportHeight)
    popupY = viewportHeight - popup.offsetHeight - 5;

  popup.style.left = popupX + "px";
  popup.style.top = popupY + "px";
  popup.style.visibility = "visible";

  gsap.fromTo(
    popup,
    { scale: 0, opacity: 0 },
    {
      scale: 1 + gameState.comboCount * 0.1,
      opacity: 1,
      duration: 0.5,
      ease: "back.out(1.7)"
    }
  );

  gsap.to(popup, {
    y: `-=${80 + gameState.comboCount * 10}`,
    opacity: 0,
    duration: 3.0 + gameState.comboCount * 0.4,
    ease: "power1.out",
    delay: 0.5,
    onComplete: () => {
      if (document.body.contains(popup)) {
        document.body.removeChild(popup);
      }
    }
  });
}

function updateStory() {
  let storyHtml = "";
  for (let i = 0; i < gameState.collectedWords.length; i++) {
    if (i % 5 === 0 && i > 0) storyHtml += "<br><br>";
    storyHtml += gameState.collectedWords[i] + " ";
  }
  elements.storyContent.innerHTML =
    storyHtml || "<p>The void awaits your first move. Create. Animate.</p>";
  elements.storyContent.scrollTop = elements.storyContent.scrollHeight;
}

function disintegrateSnake() {
  gameState.snakeDisintegrating = true;
  const canvasRect = elements.gameCanvas.getBoundingClientRect();

  gameState.snake.forEach((segment, index) => {
    const particle = document.createElement("div");
    particle.className = "particle";
    const size = gameState.gridSize * 0.8;

    let particleColor = gameState.currentSnakeColor;
    if (gameState.currentSnakeColor === "#0AE448") {
      particleColor = `hsla(137, 77%, ${60 - index * 2}%, 1)`;
    } else if (gameState.currentSnakeColor === "#146EF5") {
      particleColor = `hsla(217, 89%, ${60 - index * 2}%, 1)`;
    } else {
      particleColor = `hsla(0, 0%, ${70 - index * 3}%, 1)`;
    }

    Object.assign(particle.style, {
      position: "fixed",
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: particleColor,
      borderRadius: gameState.currentSnakeColor === "#0AE448" ? "30%" : "0%",
      zIndex: "150"
    });
    elements.particlesContainer.appendChild(particle);

    const worldX =
      canvasRect.left + segment.x * gameState.gridSize + gameState.gridSize / 2;
    const worldY =
      canvasRect.top + segment.y * gameState.gridSize + gameState.gridSize / 2;

    gsap.set(particle, { x: worldX - size / 2, y: worldY - size / 2 });

    gsap.to(particle, {
      duration: 0.8 + Math.random() * 0.5 + index * 0.03,
      physics2D: {
        velocity: 100 + Math.random() * 150,
        angle: -90 + Math.random() * 60 - 30,
        gravity: 200 + Math.random() * 100,
        friction: 0.05,
        angularVelocity: Math.random() * 200 - 100
      },
      opacity: 0,
      scale: 0.2,
      ease: "power1.out",
      delay: index * 0.02,
      onComplete: () =>
        elements.particlesContainer.contains(particle) &&
        elements.particlesContainer.removeChild(particle)
    });
  });
  setTimeout(() => {
    gameState.snake = [];
  }, 1500);
}

function gameOver() {
  gameState.gameRunning = false;
  [
    gameState.gameLoop,
    gameState.meteorInterval,
    gameState.backgroundMeteorInterval,
    gameState.catThrowsLogoInterval
  ].forEach(clearInterval);

  addTerminalLine(
    "CRITICAL_ERROR_0XDEADBEEF :: ENTITY_COLLAPSE_IMMINENT :: GSAP_Timeline_Interrupted",
    "fatal_error"
  );
  disintegrateSnake();

  setTimeout(clearAllMeteors, 1500);
  elements.statusValue.textContent = "NULL_SECTOR";

  triggerScreenShake(1.8, 1.3);
  playSoundWithPitch(audio.gameOverSound, 1.0, 0.85, 0.95);
  audio.backgroundMusic.pause();
  audio.backgroundMusic.currentTime = 0;
  const canvasRect = elements.gameCanvas.getBoundingClientRect();
  const explosionX =
    canvasRect.left +
    (gameState.collisionPoint.x * gameState.gridSize + gameState.gridSize / 2);
  const explosionY =
    canvasRect.top +
    (gameState.collisionPoint.y * gameState.gridSize + gameState.gridSize / 2);
  createMegaGameOverExplosion(explosionX, explosionY);
  elements.finalScore.textContent = gameState.logosFound;
  setTimeout(() => {
    Object.assign(elements.gameOverOverlay.style, {
      opacity: "1",
      pointerEvents: "auto"
    });
  }, 1800);
}

function createMegaGameOverExplosion(x, y) {
  const baseTotalParticles = 110;
  const totalParticles = Math.floor(
    baseTotalParticles * (1 + gameState.burstIntensity * 0.25)
  );
  const colors = [
    "#ff4e4e",
    "#ff8f4e",
    "#ffcf4e",
    "#ffffff",
    "#ff6b9d",
    "#ff3030",
    "#FFD700"
  ];

  playSoundWithPitch(audio.explosionSound, 0.85, 0.55, 0.65);
  setTimeout(
    () => playSoundWithPitch(audio.explosionSound, 0.55, 0.5, 0.6),
    100
  );
  setTimeout(
    () => playSoundWithPitch(audio.explosionSound, 0.35, 0.45, 0.55),
    200
  );

  const numWaves = 4;
  for (let wave = 0; wave < numWaves; wave++) {
    setTimeout(() => {
      const waveParticles = Math.floor(totalParticles / numWaves);
      for (let i = 0; i < waveParticles; i++) {
        const particle = document.createElement("div");
        particle.className = "particle";
        const size = Math.random() * 22 + 8;
        Object.assign(particle.style, {
          position: "fixed",
          backgroundColor: colors[Math.floor(Math.random() * colors.length)],
          width: size + "px",
          height: size + "px",
          borderRadius: Math.random() > 0.2 ? "0" : "50%",
          pointerEvents: "none",
          zIndex: "100",
          boxShadow: `0 0 ${Math.random() * 4 + 2}px ${
            colors[Math.floor(Math.random() * colors.length)]
          }77`
        });
        elements.particlesContainer.appendChild(particle);
        gsap.set(particle, { x, y, scale: Math.random() * 2.0 + 0.5 });
        gsap.to(particle, {
          duration: 2.2 + Math.random() * 1.2,
          physics2D: {
            velocity:
              (Math.random() * 400 + 150 + wave * 70) *
              (1 + gameState.burstIntensity * 0.15),
            angle: Math.random() * 360,
            gravity: 160 + wave * 25,
            friction: 0.02,
            angularVelocity: Math.random() * 450 - 225
          },
          opacity: 0,
          scale: 0.05,
          ease: "power1.out",
          onComplete: () =>
            elements.particlesContainer.contains(particle) &&
            elements.particlesContainer.removeChild(particle)
        });
      }

      if (wave < 2) {
        const shockParticle = document.createElement("div");
        const shockSize = 60 + wave * 40;
        Object.assign(shockParticle.style, {
          position: "fixed",
          width: `${shockSize}px`,
          height: `${shockSize}px`,
          borderRadius: "50%",
          border: `4px solid rgba(255,120,100, ${0.6 - wave * 0.15})`,
          opacity: 0.9 - wave * 0.2,
          zIndex: 99
        });
        elements.particlesContainer.appendChild(shockParticle);
        gsap.set(shockParticle, {
          x: x - shockSize / 2,
          y: y - shockSize / 2,
          scale: 0.1
        });
        gsap.to(shockParticle, {
          duration: 0.6 + wave * 0.15,
          scale: 1.8 + wave * 0.3,
          opacity: 0,
          ease: "expo.out",
          onComplete: () =>
            elements.particlesContainer.contains(shockParticle) &&
            elements.particlesContainer.removeChild(shockParticle)
        });
      }
    }, wave * 70);
  }

  const screenTint = document.createElement("div");
  Object.assign(screenTint.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(255, 80, 60, 0.35)",
    zIndex: 998,
    pointerEvents: "none",
    opacity: 0
  });
  document.body.appendChild(screenTint);
  gsap.to(screenTint, {
    opacity: 1,
    duration: 0.1,
    yoyo: true,
    repeat: 1,
    ease: "power1.inOut",
    onComplete: () =>
      document.body.contains(screenTint) &&
      document.body.removeChild(screenTint)
  });
}

function addTerminalLine(text, type = "info") {
  const line = document.createElement("div");
  line.className = "terminal-line";

  let prefix = "[LOG_INFO]";
  switch (type) {
    case "system_init":
      prefix = "[SYS_BOOT]";
      break;
    case "data_spawn":
      prefix = "[DATA_FRAG]";
      break;
    case "gsap_spawn":
      prefix = "[GSAP_SIGNAL]";
      break;
    case "webflow_spawn":
      prefix = "[WF_CONSTRUCT]";
      break;
    case "food_eat_pixel":
      prefix = "[DATA_INTAKE]";
      break;
    case "gsap_eat":
      prefix = "[GSAP_MODULE]";
      break;
    case "webflow_eat":
      prefix = "[WF_SCHEMA]";
      break;
    case "level_up":
      prefix = "[CORE_EVOLVE]";
      break;
    case "pause":
      prefix = "[CHRONO_SUSPEND]";
      break;
    case "resume":
      prefix = "[CHRONO_RESUME]";
      break;
    case "audio_on":
      prefix = "[AUDIO_SYS_ON]";
      break;
    case "audio_off":
      prefix = "[AUDIO_SYS_OFF]";
      break;
    case "settings":
      prefix = "[SYS_CONFIG]";
      break;
    case "fatal_error":
      prefix = "[KERNEL_PANIC_0xDEADCODE]";
      break;
  }

  let styledText = text;
  if (type === "fatal_error")
    styledText = `//_! ${text
      .toUpperCase()
      .replace(
        /\s/g,
        "_"
      )} !// :: GSAP_TIMELINE_HALTED :: PHYSICS2D_VECTOR_NULL`;
  if (type === "level_up")
    styledText = `//** ${text.replace(
      /\s/g,
      "_"
    )} :: GSAP_PHYSICS2D_RECALIBRATING_FORCES **//`;
  if (type === "gsap_eat")
    styledText = `:: GSAP_Physics2D_VELOCITY_AUGMENTED (${text
      .split("::")[1]
      .trim()}) :: GSAP_MotionPath_Plugin_Simulating_New_Trajectory`;
  if (type === "webflow_eat")
    styledText = `:: Webflow_COMPONENT_STRUCTURE_FORTIFIED (${text
      .split("::")[1]
      .trim()}) :: WF_Grid_Adaptive_Recalculation`;
  if (type === "data_spawn" && text.includes("Coords"))
    styledText = `Acquiring_Target_Lock_On_Data_Fragment :: ${text} :: WF_Grid_Scan_Complete`;
  if (type === "settings" && text.includes("Temporal_Flow"))
    styledText = `GSAP_TimeScale_Modulation_Engaged :: ${text}`;
  if (type === "settings" && text.includes("WF-Grid_Density"))
    styledText = `Webflow_Layout_Engine_Responsive_Recalculation :: ${text}`;
  if (type === "settings" && text.includes("Kinetic_Impulse"))
    styledText = `GSAP_PhysicsProps_Plugin_Impact_Force_Set :: ${text}`;

  line.textContent = `${prefix} :: ${styledText}`;
  const typingLine = elements.terminalContent.querySelector(".typing");
  if (typingLine) typingLine.classList.remove("typing");
  elements.terminalContent.appendChild(line);
  const newTypingLine = document.createElement("div");
  newTypingLine.className = "terminal-line typing";
  elements.terminalContent.appendChild(newTypingLine);
  elements.terminalContent.scrollTop = elements.terminalContent.scrollHeight;
  const lines = elements.terminalContent.querySelectorAll(
    ".terminal-line:not(.typing)"
  );
  if (lines.length > 60) lines[0].remove();
}

function updateClock() {
  const now = new Date();
  const timeString = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  if (elements.timestamp)
    elements.timestamp.textContent = `SYS_TIME: ${timeString}`; // Themed
  setTimeout(updateClock, 1000);
}

function startMeteorSpawning() {
  if (!gameState.gameRunning || gameState.gamePaused || !gameState.tabActive)
    return;
  clearInterval(gameState.meteorInterval);
  gameState.meteorInterval = setInterval(() => {
    if (gameState.activeMeteors < CONSTANTS.MAX_METEORS && Math.random() < 0.35)
      spawnEnhancedMeteor();
  }, 4000);
}

function startBackgroundMeteorShower() {
  if (!gameState.tabActive) return;
  clearInterval(gameState.backgroundMeteorInterval);
  gameState.backgroundMeteorInterval = setInterval(() => {
    if (gameState.activeMeteors < CONSTANTS.MAX_METEORS && Math.random() < 0.5)
      spawnBackgroundMeteor();
  }, 1500);
}

function createMeteorPixels(
  meteor,
  meteorSize,
  pixelSize,
  isBackground = false
) {
  const grid = meteorSize / pixelSize;
  const center = grid / 2;
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const dx = x - center,
        dy = y - center,
        dist = Math.hypot(dx, dy);
      if (isBackground) {
        if (x + y >= grid / 2 && x + y <= grid * 1.5) {
          const px = document.createElement("div");
          Object.assign(px.style, {
            position: "absolute",
            width: `${pixelSize}px`,
            height: `${pixelSize}px`,
            left: `${x * pixelSize}px`,
            top: `${y * pixelSize}px`,
            backgroundColor: CONSTANTS.METEOR_COLORS.outer,
            opacity: "0.8"
          });
          meteor.appendChild(px);
        }
      } else {
        if (dist < center / 2.5) {
          const px = document.createElement("div");
          Object.assign(px.style, {
            position: "absolute",
            width: `${pixelSize}px`,
            height: `${pixelSize}px`,
            left: `${x * pixelSize}px`,
            top: `${y * pixelSize}px`,
            backgroundColor: CONSTANTS.METEOR_COLORS.core
          });
          meteor.appendChild(px);
        } else if (dist < center / 1.8) {
          const px = document.createElement("div");
          Object.assign(px.style, {
            position: "absolute",
            width: `${pixelSize}px`,
            height: `${pixelSize}px`,
            left: `${x * pixelSize}px`,
            top: `${y * pixelSize}px`,
            backgroundColor: CONSTANTS.METEOR_COLORS.outer,
            opacity: `${1 - dist / center}`
          });
          meteor.appendChild(px);
        }
      }
    }
  }
}

function spawnEnhancedMeteor() {
  if (
    gameState.activeMeteors >= CONSTANTS.MAX_METEORS ||
    !gameState.gameRunning ||
    gameState.gamePaused ||
    !gameState.tabActive
  )
    return;
  gameState.activeMeteors++;
  const meteor = document.createElement("div");
  meteor.className = "meteor";
  const meteorSize = 28 + Math.random() * 8;
  Object.assign(meteor.style, {
    width: `${meteorSize}px`,
    height: `${meteorSize}px`,
    position: "fixed",
    top: "0",
    left: "0",
    zIndex: "80",
    opacity: "0.9",
    background: "transparent",
    filter: "brightness(1.1) contrast(1.05)"
  });
  createMeteorPixels(meteor, meteorSize, 3);
  const {
    left,
    top,
    width,
    height
  } = elements.gameCanvas.getBoundingClientRect();
  const startX = window.innerWidth + meteorSize;
  const startY = -meteorSize - Math.random() * 120;
  const endX = left - meteorSize - Math.random() * 120;
  const endY = top + height + Math.random() * 200;
  gsap.set(meteor, { x: startX, y: startY, rotation: 40 + Math.random() * 10 });
  elements.meteorContainer.appendChild(meteor);
  if (
    gameState.audioEnabled &&
    gameState.gameRunning &&
    !gameState.gamePaused &&
    gameState.tabActive
  ) {
    audio.meteorSound.currentTime = 0;
    audio.meteorSound.volume = gameState.sfxVolume * 0.3;
    audio.meteorSound
      .play()
      .catch((e) => console.warn("Meteor sound (HTML) play error", e));
  }
  const trails = Array.from({ length: 3 }).map((_, i) => {
    const t = document.createElement("div");
    t.className = "meteor-trail";
    Object.assign(t.style, {
      position: "fixed",
      width: `${meteorSize * (0.5 - i * 0.1)}px`,
      height: `${meteorSize * (0.5 - i * 0.1)}px`,
      background: CONSTANTS.METEOR_COLORS.trail,
      opacity: `${(0.6 - i * 0.15).toFixed(2)}`,
      borderRadius: "50%",
      filter: "blur(1px)",
      zIndex: "79"
    });
    elements.meteorContainer.appendChild(t);
    return t;
  });
  gsap.to(meteor, {
    x: endX,
    y: endY,
    duration: 2.0 + Math.random() * 0.6,
    ease: "power1.in",
    onUpdate() {
      if (!gameState.gameRunning || gameState.gamePaused) {
        this.kill();
        return;
      }
      const p = this.progress();
      trails.forEach((t, i) => {
        const tp = Math.max(0, p - i * 0.06);
        if (tp > 0 && elements.meteorContainer.contains(t)) {
          gsap.set(t, {
            x: gsap.utils.interpolate(startX, endX, tp),
            y: gsap.utils.interpolate(startY, endY, tp),
            opacity: Math.max(0, 0.6 - p * 0.7 - i * 0.1)
          });
        }
      });
    },
    onComplete: () => {
      if (gameState.gameRunning && !gameState.gamePaused && Math.random() < 0.5)
        createSuperMeteorExplosion(endX + meteorSize / 2, endY);
      [meteor, ...trails].forEach(
        (el) =>
          elements.meteorContainer.contains(el) &&
          elements.meteorContainer.removeChild(el)
      );
      gameState.activeMeteors--;
    },
    onInterrupt: () => {
      [meteor, ...trails].forEach(
        (el) =>
          elements.meteorContainer.contains(el) &&
          elements.meteorContainer.removeChild(el)
      );
      gameState.activeMeteors--;
    }
  });
}

function spawnBackgroundMeteor() {
  if (gameState.activeMeteors >= CONSTANTS.MAX_METEORS || !gameState.tabActive)
    return;
  gameState.activeMeteors++;
  const meteor = document.createElement("div");
  meteor.className = "meteor";
  const meteorSize = 8 + Math.random() * 5;
  Object.assign(meteor.style, {
    width: `${meteorSize}px`,
    height: `${meteorSize}px`,
    position: "fixed",
    top: "0",
    left: "0",
    zIndex: "40",
    opacity: "0.75",
    background: "transparent"
  });
  createMeteorPixels(meteor, meteorSize, 1.5, true);
  const startX = window.innerWidth + Math.random() * 250;
  const startY = -meteorSize - Math.random() * 70;
  const endX = -meteorSize - Math.random() * 120;
  const endY = window.innerHeight * (0.1 + Math.random() * 0.7);
  gsap.set(meteor, { x: startX, y: startY, rotation: 40 + Math.random() * 10 });
  elements.meteorContainer.appendChild(meteor);
  const trail = document.createElement("div");
  trail.className = "meteor-trail";
  Object.assign(trail.style, {
    position: "fixed",
    width: `${meteorSize * 0.7}px`,
    height: `${meteorSize * 0.7}px`,
    background: CONSTANTS.METEOR_COLORS.trail,
    opacity: "0.4",
    borderRadius: "50%",
    filter: "blur(1px)",
    zIndex: "39"
  });
  elements.meteorContainer.appendChild(trail);
  gsap.to(meteor, {
    x: endX,
    y: endY,
    duration: 3.8 + Math.random() * 1.2,
    ease: "power1.in",
    onUpdate() {
      if (!gameState.tabActive) {
        this.kill();
        return;
      }
      const p = this.progress();
      if (elements.meteorContainer.contains(trail)) {
        gsap.set(trail, {
          x: gsap.utils.interpolate(startX, endX, Math.max(0, p - 0.08)),
          y: gsap.utils.interpolate(startY, endY, Math.max(0, p - 0.08)),
          opacity: 0.4 * (1 - p)
        });
      }
    },
    onComplete: () => {
      if (gameState.tabActive && Math.random() < 0.3)
        createBackgroundMeteorExplosion(endX + meteorSize / 2, endY);
      [meteor, trail].forEach(
        (el) =>
          elements.meteorContainer.contains(el) &&
          elements.meteorContainer.removeChild(el)
      );
      gameState.activeMeteors--;
    },
    onInterrupt: () => {
      [meteor, trail].forEach(
        (el) =>
          elements.meteorContainer.contains(el) &&
          elements.meteorContainer.removeChild(el)
      );
      gameState.activeMeteors--;
    }
  });
}

function createSuperMeteorExplosion(x, y) {
  const particleCount = 20;
  const colors = [
    CONSTANTS.METEOR_COLORS.core,
    CONSTANTS.METEOR_COLORS.outer,
    CONSTANTS.METEOR_COLORS.trail,
    CONSTANTS.METEOR_COLORS.flash
  ];
  playSoundWithPitch(audio.explosionSound, 0.35, 0.9, 1.1);
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size = Math.random() * 10 + 5;
    Object.assign(p.style, {
      position: "fixed",
      background: colors[i % colors.length],
      width: size + "px",
      height: size + "px",
      borderRadius: Math.random() > 0.4 ? "0" : "50%",
      pointerEvents: "none",
      zIndex: "100"
    });
    elements.particlesContainer.appendChild(p);
    gsap.set(p, { x, y, scale: 1.1 });
    gsap.to(p, {
      duration: 1.8 + Math.random() * 0.5,
      physics2D: {
        velocity: Math.random() * 200 + 100,
        angle: Math.random() * 360,
        gravity: 120,
        friction: 0.025
      },
      opacity: 0,
      rotation: Math.random() * 270,
      onComplete: () =>
        elements.particlesContainer.contains(p) &&
        elements.particlesContainer.removeChild(p)
    });
  }
}

function createBackgroundMeteorExplosion(x, y) {
  const particleCount = 8;
  playSoundWithPitch(audio.explosionSound, 0.12, 1.0, 1.2);
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    Object.assign(p.style, {
      position: "fixed",
      background: CONSTANTS.METEOR_COLORS.outer,
      width: "5px",
      height: "5px",
      borderRadius: "50%",
      opacity: "0.7",
      pointerEvents: "none",
      zIndex: "50"
    });
    elements.meteorContainer.appendChild(p);
    gsap.set(p, { x, y, scale: 0.7 });
    gsap.to(p, {
      duration: 1.0,
      physics2D: {
        velocity: Math.random() * 100 + 30,
        angle: Math.random() * 360,
        gravity: 50
      },
      opacity: 0,
      onComplete: () =>
        elements.particlesContainer.contains(p) &&
        elements.particlesContainer.removeChild(p)
    });
  }
}

// --- Cat Throws Logo ---
function startCatLogoThrowing() {
  if (gameState.catThrowsLogoInterval)
    clearInterval(gameState.catThrowsLogoInterval);

  function scheduleNextThrow() {
    const delay =
      Math.random() *
        (CONSTANTS.CAT_THROW_INTERVAL_MAX - CONSTANTS.CAT_THROW_INTERVAL_MIN) +
      CONSTANTS.CAT_THROW_INTERVAL_MIN;
    gameState.catThrowsLogoInterval = setTimeout(() => {
      if (
        gameState.gameRunning &&
        !gameState.gamePaused &&
        gameState.tabActive
      ) {
        spawnLogoFromCat();
      }
      scheduleNextThrow();
    }, delay);
  }
  scheduleNextThrow();
}

function _spawnSingleLogoFromCat(logoTypeToThrow, catRect, delay = 0) {
  if (!logoTypeToThrow) return;

  const startX = catRect.left + catRect.width / 2 + 10;
  const startY = catRect.top + catRect.height / 2 - 10;

  const logoImgElement = document.createElement("img");
  logoImgElement.style.position = "fixed";
  logoImgElement.style.width = `${PIXEL_ART_SIZE * 0.8}px`;
  logoImgElement.style.height = `${PIXEL_ART_SIZE * 0.8}px`;
  logoImgElement.style.opacity = "0.85";
  logoImgElement.style.imageRendering = "pixelated";
  logoImgElement.style.setProperty(
    "-ms-interpolation-mode",
    "nearest-neighbor"
  );
  logoImgElement.style.pointerEvents = "none";

  logoImgElement.src =
    logoTypeToThrow === "gsap" ? gsapPixelArtSrc : webflowPixelArtSrc;

  elements.catLogoContainer.appendChild(logoImgElement);

  const canvasRect = elements.gameCanvas.getBoundingClientRect();
  const targetX =
    canvasRect.left +
    Math.random() * canvasRect.width * 0.8 +
    canvasRect.width * 0.1;
  const targetY =
    canvasRect.top +
    Math.random() * canvasRect.height * 0.7 +
    canvasRect.height * 0.1;

  let angle = Math.atan2(targetY - startY, targetX - startX) * (180 / Math.PI);
  angle += gsap.utils.random(-10, 10);

  const velocity = 220 + Math.random() * 80;

  gsap.set(logoImgElement, {
    x: startX,
    y: startY,
    scale: 0.7,
    rotation: Math.random() * 60 - 30
  });

  gsap.to(logoImgElement, {
    duration: 1.6 + Math.random() * 0.6,
    physics2D: {
      velocity: velocity,
      angle: angle,
      gravity: 250,
      friction: 0.02,
      angularVelocity: Math.random() * 250 - 125
    },
    scale: 0,
    opacity: 0,
    ease: "circ.in",
    delay: delay,
    onComplete: () => {
      if (elements.catLogoContainer.contains(logoImgElement)) {
        elements.catLogoContainer.removeChild(logoImgElement);
      }
    }
  });
}

function spawnLogoFromCat() {
  if (!elements.catSprite || (!gsapPixelArtSrc && !webflowPixelArtSrc)) {
    return;
  }
  const catRect = elements.catSprite.getBoundingClientRect();

  const firstLogoType =
    gsapPixelArtSrc && webflowPixelArtSrc
      ? Math.random() < 0.5
        ? "gsap"
        : "webflow"
      : gsapPixelArtSrc
      ? "gsap"
      : webflowPixelArtSrc
      ? "webflow"
      : null;
  _spawnSingleLogoFromCat(firstLogoType, catRect, 0);

  if (Math.random() < 0.35) {
    const secondLogoType =
      firstLogoType === "gsap" && webflowPixelArtSrc
        ? "webflow"
        : gsapPixelArtSrc
        ? "gsap"
        : null;
    if (secondLogoType && secondLogoType !== firstLogoType) {
      _spawnSingleLogoFromCat(
        secondLogoType,
        catRect,
        Math.random() * 0.3 + 0.2
      );
    }
  }
}

// Event listeners
document.addEventListener("keydown", function (e) {
  if ([37, 38, 39, 40].indexOf(e.keyCode) > -1 && gameState.gameRunning) {
    // Only prevent default if game is running for arrows
    e.preventDefault();
  }

  if (e.key === " " || e.key === "Enter") {
    if (elements.startScreen.style.display !== "none") {
      e.preventDefault();
      elements.startBtn.click();
      return;
    }
    if (elements.gameOverOverlay.style.opacity === "1") {
      e.preventDefault();
      elements.restartBtn.click();
      return;
    }
  }

  const directions = {
    38: gameState.direction !== "down" ? "up" : null,
    40: gameState.direction !== "up" ? "down" : null,
    37: gameState.direction !== "right" ? "left" : null,
    39: gameState.direction !== "left" ? "right" : null
  };
  if (directions[e.keyCode] && gameState.gameRunning && !gameState.gamePaused) {
    gameState.nextDirection = directions[e.keyCode];
  }
});

// Touch Controls
let touchProcessed = false; // To prevent multiple direction changes from one swipe

elements.gameCanvas.addEventListener(
  "touchstart",
  function (e) {
    if (!gameState.gameRunning || gameState.gamePaused) return;
    e.preventDefault(); // Prevent default touch actions like scrolling, zooming
    const touch = e.touches[0];
    gameState.touchStartX = touch.clientX;
    gameState.touchStartY = touch.clientY;
    gameState.touchMoved = false; // Reset moved flag for this touch
    touchProcessed = false; // Allow new direction for new touch
  },
  { passive: false }
);

elements.gameCanvas.addEventListener(
  "touchmove",
  function (e) {
    if (
      !gameState.gameRunning ||
      gameState.gamePaused ||
      !e.touches.length ||
      touchProcessed
    )
      return;
    e.preventDefault(); // Prevent scrolling during swipe

    const touch = e.touches[0];
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;

    const diffX = touchEndX - gameState.touchStartX;
    const diffY = touchEndY - gameState.touchStartY;

    if (
      Math.abs(diffX) > gameState.swipeThreshold ||
      Math.abs(diffY) > gameState.swipeThreshold
    ) {
      gameState.touchMoved = true; // Mark that a swipe occurred
      let newDirection = null;

      if (Math.abs(diffX) > Math.abs(diffY)) {
        // Horizontal swipe
        if (diffX > 0 && gameState.direction !== "left") newDirection = "right";
        else if (diffX < 0 && gameState.direction !== "right")
          newDirection = "left";
      } else {
        // Vertical swipe
        if (diffY > 0 && gameState.direction !== "up") newDirection = "down";
        else if (diffY < 0 && gameState.direction !== "down")
          newDirection = "up";
      }

      if (newDirection) {
        gameState.nextDirection = newDirection;
        touchProcessed = true; // Process this swipe only once
      }
    }
  },
  { passive: false }
);

elements.gameCanvas.addEventListener(
  "touchend",
  function (e) {
    if (!gameState.gameRunning || gameState.gamePaused) return;
    // If it was a tap (not a swipe), and game is over, simulate restart click
    if (
      !gameState.touchMoved &&
      elements.gameOverOverlay.style.opacity === "1"
    ) {
      elements.restartBtn.click();
    }
    // If it was a tap on start screen
    else if (
      !gameState.touchMoved &&
      elements.startScreen.style.display !== "none"
    ) {
      elements.startBtn.click();
    }
    touchProcessed = false; // Reset for next touch interaction
    gameState.touchMoved = false;
  },
  { passive: false }
);

elements.startBtn.addEventListener("click", startGame);
if (elements.resetBtn) elements.resetBtn.addEventListener("click", setupGame);
if (elements.restartBtn)
  elements.restartBtn.addEventListener("click", setupGame);
elements.pauseBtn.addEventListener("click", function () {
  if (gameState.gameRunning) {
    gameState.gamePaused = !gameState.gamePaused;
    elements.pauseBtn.textContent = gameState.gamePaused ? "RESUME" : "PAUSE";
    if (gameState.gamePaused) {
      addTerminalLine("Stream suspended.", "pause");
      elements.statusValue.textContent = "STASIS";
      clearInterval(gameState.meteorInterval);
      clearInterval(gameState.backgroundMeteorInterval);
      clearInterval(gameState.catThrowsLogoInterval);
      if (gameState.audioEnabled) audio.backgroundMusic.pause();
      if (audioContext && audioContext.state === "running")
        audioContext
          .suspend()
          .catch((e) =>
            console.warn("AudioContext suspend on pause failed:", e)
          );
    } else {
      addTerminalLine("Stream reactivated.", "resume");
      elements.statusValue.textContent = "ACTIVE";
      if (audioContext && audioContext.state === "suspended")
        audioContext
          .resume()
          .catch((e) => console.warn("AudioContext resume on play failed:", e));
      if (gameState.tabActive) {
        startMeteorSpawning();
        startBackgroundMeteorShower();
        startCatLogoThrowing();
      }
      if (gameState.audioEnabled) {
        audio.backgroundMusic.volume = gameState.musicVolume;
        audio.backgroundMusic
          .play()
          .catch((e) => console.warn("BG Music play error:", e));
      }
    }
  }
});
elements.audioToggle.addEventListener("click", function () {
  gameState.audioEnabled = !gameState.audioEnabled;
  this.textContent = gameState.audioEnabled ? "🔊" : "🔇";
  if (gameState.audioEnabled) {
    if (audioContext && audioContext.state === "suspended")
      audioContext
        .resume()
        .catch((e) => console.warn("AudioContext resume on toggle failed:", e));
    if (gameState.gameRunning && !gameState.gamePaused) {
      audio.backgroundMusic.volume = gameState.musicVolume;
      audio.backgroundMusic
        .play()
        .catch((e) => console.warn("BG Music play error:", e));
    }
    addTerminalLine("Auditory stream online.", "audio_on");
  } else {
    audio.backgroundMusic.pause();
    Object.values(sfxNodes).forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {}
    });
    for (const key in sfxNodes) delete sfxNodes[key];
    addTerminalLine("Auditory stream muted.", "audio_off");
  }
});
elements.speedSlider.addEventListener("input", function () {
  const value = parseFloat(this.value);
  elements.speedValue.textContent = value.toFixed(1);
  if (gameState.gameRunning) {
    gameState.baseSpeed = value;
    gameState.gameSpeed = 150 / value;
    clearInterval(gameState.gameLoop);
    gameState.gameLoop = setInterval(updateGame, gameState.gameSpeed);
    addTerminalLine(
      `Temporal_Flow adjusted to ${value.toFixed(1)}x.`,
      "settings"
    );
  }
});
elements.resolutionSlider.addEventListener("input", function () {
  const value = parseInt(this.value);
  elements.resolutionValue.textContent = value;
  if (gameState.gameRunning) {
    gameState.gridSize = value;
    gameState.tileCount = Math.floor(
      elements.gameCanvas.width / gameState.gridSize
    );
    updateGridOverlay();
    gameState.snake.forEach((segment) => {
      segment.x = Math.min(segment.x, gameState.tileCount - 1);
      segment.y = Math.min(segment.y, gameState.tileCount - 1);
    });
    gameState.food.x = Math.min(gameState.food.x, gameState.tileCount - 1);
    gameState.food.y = Math.min(gameState.food.y, gameState.tileCount - 1);
    draw();
    addTerminalLine(`WF-Grid_Density calibrated to ${value}px.`, "settings");
  }
});
elements.burstSlider.addEventListener("input", function () {
  const value = parseFloat(this.value);
  elements.burstValue.textContent = value.toFixed(1);
  gameState.burstIntensity = value;
  addTerminalLine(`Kinetic_Impulse set to ${value.toFixed(1)}x.`, "settings");
});
elements.musicVolumeSlider.addEventListener("input", function () {
  const value = parseFloat(this.value);
  gameState.musicVolume = value;
  elements.musicVolumeValue.textContent = value.toFixed(1);
  audio.backgroundMusic.volume = gameState.musicVolume;
  addTerminalLine(
    `Ambient_Harmonics_Level: ${(value * 100).toFixed(0)}%`,
    "settings"
  );
});
elements.sfxVolumeSlider.addEventListener("input", function () {
  const value = parseFloat(this.value);
  gameState.sfxVolume = value;
  elements.sfxVolumeValue.textContent = value.toFixed(1);
  addTerminalLine(
    `Transient_Signal_Gain: ${(value * 100).toFixed(0)}%`,
    "settings"
  );
});
window.onload = initLoading;